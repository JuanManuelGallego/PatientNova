import { AppointmentStatus, Channel, ReminderMode, ReminderStatus, type AppointmentLocation, type AppointmentType, type Patient, type Reminder } from '../../generated/prisma/client.ts';
import { fromPrisma } from 'pg-boss';
import { appointmentRepository } from './appointment.repository.js';
import {
  AppointmentConflictError,
  AppointmentPatientNotFoundError,
  AppointmentReminderNotFoundError,
  AppointmentStatusTransitionError,
  AppointmentBlockedTimeConflictError,
  AppointmentInvalidTimeRangeError,
  PastAppointmentLockedError,
} from './appointment.errors.js';
import { LocationNotFoundError } from '../utils/errors/errors.js';
import { AppointmentTypeNotFoundError } from '../appointment-types/appointment-type.errors.js';
import type { CreateAppointmentDto, UpdateAppointmentDto, ListAppointmentsQuery, AppointmentStatsQuery } from './appointment.schemas.ts';
import { appointmentMeetingService } from './appointment-meeting.service.ts';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.ts';
import { withProviderLock } from '../utils/prisma/provider-lock.ts';
import { logger } from '../utils/api/logger.ts';
import type { AppointmentWithRelations, AppointmentStats } from './appointment.types.ts';
import type { Paginated } from '../utils/api/pagination.ts';
import { blockedTimeRepository } from '../blocked-time/blocked-time.repository.ts';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.ts';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { getBoss } from '../scheduler/pg-boss.js';
import { config } from '../utils/config/config.ts';
import { renderAppointmentReminder } from './appointment-reminder.renderer.ts';

const REMINDER_QUEUE = 'send-reminder';

/** Statuses that occupy the provider's calendar (mirrors the DB exclusion constraint predicate). */
const ACTIVE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
]);

const PAYABLE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
]);

const ALLOWED_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [ AppointmentStatus.SCHEDULED ]: [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
  ],
  [ AppointmentStatus.CONFIRMED ]: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.SCHEDULED,
  ],
  [ AppointmentStatus.CANCELLED ]: [ AppointmentStatus.CANCELLED, AppointmentStatus.SCHEDULED ],
  [ AppointmentStatus.COMPLETED ]: [ AppointmentStatus.COMPLETED, AppointmentStatus.SCHEDULED ],
  [ AppointmentStatus.NO_SHOW ]: [
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.SCHEDULED,
  ],
};

async function validatePatient(tx: TransactionClient, patientId: string, userId: string): Promise<Patient> {
  const patient = await tx.patient.findFirst({ where: { id: patientId, userId } });
  if (!patient) throw new AppointmentPatientNotFoundError(patientId);
  return patient;
}

async function validateLocation(tx: TransactionClient, locationId: string, userId: string): Promise<AppointmentLocation> {
  const location = await tx.appointmentLocation.findFirst({ where: { id: locationId, userId, isDeleted: false } });
  if (!location) throw new LocationNotFoundError(locationId);
  return location as AppointmentLocation;
}

async function validateType(tx: TransactionClient, typeId: string, userId: string): Promise<AppointmentType> {
  const type = await tx.appointmentType.findFirst({ where: { id: typeId, userId, isDeleted: false } });
  if (!type) throw new AppointmentTypeNotFoundError(typeId);
  return type;
}

async function validateReminder(
  tx: TransactionClient,
  reminderId: string | null | undefined,
  userId: string,
  patientId: string,
  appointmentId?: string,
): Promise<Reminder | null> {
  if (reminderId) {
    const reminder = await tx.reminder.findFirst({
      where: { id: reminderId, userId, patientId, isDeleted: false },
    });
    if (!reminder) throw new AppointmentReminderNotFoundError(reminderId);
    if (reminder.appointmentId && reminder.appointmentId !== appointmentId) {
      throw new AppointmentReminderNotFoundError(reminderId);
    }
    return reminder;
  }
  return null;
}

async function getDoctorName(tx: TransactionClient, userId: string): Promise<string> {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { displayName: true, firstName: true, lastName: true },
  });
  return user.displayName ?? ([user.firstName, user.lastName].filter(Boolean).join(' ') || 'su profesional de salud');
}

async function renderLinkedReminder(
  appointment: AppointmentWithRelations,
  doctorName: string,
  tx: TransactionClient,
): Promise<AppointmentWithRelations> {
  const payload = renderAppointmentReminder(appointment, doctorName);
  if (!appointment.reminder || !payload) return appointment;
  await tx.reminder.update({ where: { id: appointment.reminder.id }, data: payload });
  return { ...appointment, reminder: { ...appointment.reminder, ...payload } };
}

async function createLinkedReminder(
  dto: CreateAppointmentDto['reminder'] & { sendMode: ReminderMode; channel: Channel; to: string },
  patientId: string,
  userId: string,
  patientName: string,
  auditDescriptionPrefix: string,
  tx: TransactionClient,
): Promise<Reminder> {
  const createdReminder = await tx.reminder.create({
    data: {
      channel: dto.channel,
      to: dto.to,
      sendMode: dto.sendMode,
      contentSid: dto.contentSid || null,
      ...(dto.contentVariables && { contentVariables: dto.contentVariables }),
      sendAt: dto.sendAt ? new Date(dto.sendAt) : new Date(),
      status: dto.status ?? ReminderStatus.PENDING,
      body: dto.body || null,
      patientId,
      userId,
    },
  });

  await logAudit({
    entityType: EntityType.REMINDER,
    entityId: createdReminder.id,
    userId,
    actionType: ActionType.CREATE,
    description: `Recordatorio creado para el paciente ${patientName} via ${auditDescriptionPrefix}`,
    affectedFields: [ 'channel', 'to', 'sendMode', 'contentSid', 'contentVariables', 'sendAt', 'status', 'body', 'patientId' ],
    fieldsAfter: {
      channel: createdReminder.channel,
      sendMode: createdReminder.sendMode,
      sendAt: createdReminder.sendAt,
      to: createdReminder.to,
      contentSid: createdReminder.contentSid,
      contentVariables: createdReminder.contentVariables,
      body: createdReminder.body,
      patientId: createdReminder.patientId,
      status: createdReminder.status,
    },
    tx,
    required: true,
  });

  logger.info({ reminderId: createdReminder.id }, 'Reminder created');
  return createdReminder;
}

async function handleReminderUpdate(
  dto: UpdateAppointmentDto,
  existing: AppointmentWithRelations,
  userId: string,
  tx: TransactionClient,
): Promise<{ reminderId?: string | null | undefined; reminder?: Reminder | null }> {
  if (dto.reminder === null && existing.reminder) {
    if (existing.reminder.status === ReminderStatus.PENDING) {
      await tx.reminder.update({
        where: { id: existing.reminder.id },
        data: { status: ReminderStatus.CANCELLED },
      });

      await logAudit({
        entityType: EntityType.REMINDER,
        entityId: existing.reminder.id,
        userId,
        actionType: ActionType.UPDATE,
        description: `Recordatorio cancelado para el paciente ${existing.patient.name} ${existing.patient.lastName} via actualización de cita`,
        affectedFields: [ 'status' ],
        fieldsBefore: { status: existing.reminder.status },
        fieldsAfter: { status: ReminderStatus.CANCELLED },
        tx,
        required: true,
      });

      logger.info({ reminderId: existing.reminder.id }, 'Reminder cancelled');
    } else {
      logger.info({ reminderId: existing.reminder.id, status: existing.reminder.status }, 'Reminder unlinked (non-PENDING)');
    }
    return { reminderId: null };
  }

  if (dto.reminder && !existing.reminder) {
    const createdReminder = await createLinkedReminder(
      dto.reminder,
      existing.patientId,
      userId,
      `${existing.patient.name} ${existing.patient.lastName}`,
      'actualización de cita',
      tx,
    );
    return { reminderId: createdReminder.id, reminder: createdReminder };
  }

  if (dto.reminder && existing.reminder) {
    await tx.reminder.update({
      where: { id: existing.reminder.id },
      data: {
        ...(dto.reminder.channel && { channel: dto.reminder.channel }),
        ...(dto.reminder.to && { to: dto.reminder.to }),
        ...(dto.reminder.sendMode && { sendMode: dto.reminder.sendMode }),
        ...(dto.reminder.contentSid !== undefined && { contentSid: dto.reminder.contentSid }),
        ...(dto.reminder.contentVariables && { contentVariables: dto.reminder.contentVariables }),
        ...(dto.reminder.sendAt && { sendAt: new Date(dto.reminder.sendAt) }),
        ...(dto.reminder.status && { status: dto.reminder.status }),
        ...(dto.reminder.body !== undefined && { body: dto.reminder.body }),
      },
    });

    const diff = computeDiff(existing.reminder as unknown as Record<string, unknown>, { ...existing.reminder, ...dto.reminder } as unknown as Record<string, unknown>, Object.keys(dto.reminder));
    await logAudit({
      entityType: EntityType.REMINDER,
      entityId: existing.reminder.id,
      userId,
      actionType: ActionType.UPDATE,
      description: `Recordatorio actualizado para el paciente ${existing.patient.name} ${existing.patient.lastName} via actualización de cita`,
      ...diff,
      tx,
      required: true,
    });

    logger.info({ reminderId: existing.reminder.id }, 'Reminder updated');
  }

  return {};
}

/**
 * A provider has one calendar, so any active appointment of theirs overlapping the interval
 * conflicts (not just the same patient's). Half-open intervals: back-to-back is allowed.
 * Must run under `withProviderLock` to be race-free; the DB exclusion constraint is the backstop.
 */
async function checkConflict(
  tx: TransactionClient,
  userId: string,
  startAt: string | Date,
  endAt: string | Date,
  excludeId?: string,
): Promise<void> {
  const conflict = await tx.appointment.findFirst({
    where: {
      userId,
      isDeleted: false,
      status: { in: [ ...ACTIVE_STATUSES ] },
      ...(excludeId && { NOT: { id: excludeId } }),
      startAt: { lt: new Date(endAt) },
      endAt: { gt: new Date(startAt) },
    },
    select: { startAt: true, endAt: true },
  });
  if (conflict) {
    throw new AppointmentConflictError(conflict.startAt.toISOString(), conflict.endAt.toISOString());
  }
}

async function checkBlockedTimeConflict(
  tx: TransactionClient,
  userId: string,
  startAt: string | Date,
  endAt: string | Date,
): Promise<void> {
  const overlap = await blockedTimeRepository.hasBlockedTimeOverlap(userId, new Date(startAt), new Date(endAt), undefined, tx);
  if (overlap) {
    throw new AppointmentBlockedTimeConflictError(overlap.description, overlap.startTimeUtc, overlap.endTimeUtc);
  }
}

async function enqueueImmediateReminder(reminderId: string, tx: TransactionClient): Promise<void> {
  if (!config.scheduler.enabled) return;
  await getBoss().send(REMINDER_QUEUE, { reminderId }, { db: fromPrisma(tx) });
}

/**
 * Creates an appointment inside the caller's transaction. Takes the provider lock first, then
 * validates and checks conflicts on `tx`, so validation and insert see one consistent calendar.
 * Callers needing extra atomic steps (portal booking: patient, consent, audits, email enqueue)
 * compose them in the same `tx`.
 */
export async function createWithin(
  tx: TransactionClient,
  dto: CreateAppointmentDto,
  userId: string,
): Promise<AppointmentWithRelations> {
  await withProviderLock(tx, userId);

  const existingReminder = await validateReminder(tx, dto.reminderId, userId, dto.patientId);
  const patient = await validatePatient(tx, dto.patientId, userId);
  const location = await validateLocation(tx, dto.locationId, userId);
  await validateType(tx, dto.typeId, userId);
  const doctorName = await getDoctorName(tx, userId);

  await checkConflict(tx, userId, dto.startAt, dto.endAt);
  await checkBlockedTimeConflict(tx, userId, dto.startAt, dto.endAt);

  const meetingUrl = appointmentMeetingService.resolveMeetingUrl({
    location,
    existingUrl: null,
    desiredUrl: dto.meetingUrl,
    appointmentId: 'new',
  });

    let createdReminder: Reminder | null = null;

    if (dto.reminder) {
      createdReminder = await createLinkedReminder(
        dto.reminder,
        dto.patientId,
        userId,
        `${patient.name} ${patient.lastName}`,
        'creación de cita',
        tx,
      );

      if (dto.reminder.sendMode === ReminderMode.IMMEDIATE) {
        await enqueueImmediateReminder(createdReminder.id, tx);
      }
    }

    const reminderId = createdReminder?.id ?? existingReminder?.id ?? dto.reminderId ?? null;

    const created = await appointmentRepository.create(
      { ...dto, meetingUrl: meetingUrl ?? null, reminderId: reminderId ?? undefined },
      userId,
      tx,
    );

    await logAudit({
       entityType: EntityType.APPOINTMENT,
       entityId: created.id,
       userId,
       actionType: ActionType.CREATE,
      description: `Cita creada para el paciente ${patient.name} ${patient.lastName}`,
      affectedFields: Object.keys(dto),
      fieldsAfter: {
        patientId: created.patientId,
        startAt: created.startAt,
        endAt: created.endAt,
        typeId: created.typeId,
        locationId: created.locationId,
        price: created.price,
        paid: created.paid ?? false,
        notes: created.notes ?? null,
        reminderId: reminderId ?? null,
        meetingUrl: meetingUrl ?? null,
        status: created.status ?? AppointmentStatus.SCHEDULED
      },
      tx,
      required: true,
    });

    if (createdReminder || existingReminder) {
      const linkedReminder = createdReminder ?? existingReminder!;
      await tx.reminder.update({
        where: { id: linkedReminder.id },
        data: { appointmentId: created.id },
      });
      await logAudit({
         entityType: EntityType.REMINDER,
         entityId: linkedReminder.id,
         userId,
         actionType: ActionType.UPDATE,
        description: `Recordatorio vinculado a la cita del paciente ${patient.name} ${patient.lastName}`,
        affectedFields: [ 'appointmentId' ],
        fieldsBefore: { appointmentId: null },
        fieldsAfter: { appointmentId: created.id },
        tx,
        required: true,
      });
    }

    logger.info({ appointmentId: created.id, patientId: patient.id, userId, startAt: created.startAt }, 'Appointment created');

    return renderLinkedReminder(
      created,
      doctorName,
      tx,
    );
}

export const appointmentService = {
  async findById(id: string, userId: string): Promise<AppointmentWithRelations> {
    return appointmentRepository.findByIdWithRelations(id, userId);
  },

  async findMany(
    query: ListAppointmentsQuery,
    userId: string,
    timezone?: string,
  ): Promise<Paginated<AppointmentWithRelations>> {
    return appointmentRepository.findMany(query, userId, timezone);
  },

  async getStats(
    query: AppointmentStatsQuery,
    userId: string,
    timezone?: string,
  ): Promise<AppointmentStats> {
    return appointmentRepository.getStats(query, userId, timezone);
  },

  async create(dto: CreateAppointmentDto, userId: string): Promise<AppointmentWithRelations> {
    return prisma.$transaction((tx: TransactionClient) => createWithin(tx, dto, userId), { timeout: 10000 });
  },

  async update(id: string, dto: UpdateAppointmentDto, userId: string): Promise<AppointmentWithRelations> {
    return prisma.$transaction(async (tx: TransactionClient) => {
      await withProviderLock(tx, userId);
      const existing = await appointmentRepository.findByIdWithRelations(id, userId, tx);

      const newStatus = dto.status ?? existing.status;
      if (dto.status !== undefined && !ALLOWED_STATUS_TRANSITIONS[ existing.status ].includes(dto.status)) {
        throw new AppointmentStatusTransitionError(existing.status, `change status to ${dto.status}`);
      }
      const isPast = existing.endAt.getTime() < Date.now();
      if (isPast && (newStatus === AppointmentStatus.SCHEDULED || newStatus === AppointmentStatus.CONFIRMED)) {
        throw new PastAppointmentLockedError(id);
      }

      // Only active appointments occupy the calendar. Re-check when an active appointment moves
      // or an inactive one is being reactivated (the DB exclusion constraint is the backstop).
      const willBeActive = ACTIVE_STATUSES.has(newStatus);
      const becomesActive = willBeActive && !ACTIVE_STATUSES.has(existing.status);
      const timeChanged = dto.startAt !== undefined || dto.endAt !== undefined;
      // A partial update (only startAt or only endAt) can yield end <= start; the body schema
      // only validates the pair when both are sent, so re-validate against the stored value.
      const newStart = dto.startAt ?? existing.startAt;
      const newEnd = dto.endAt ?? existing.endAt;
      if (timeChanged && new Date(newEnd).getTime() <= new Date(newStart).getTime()) {
        throw new AppointmentInvalidTimeRangeError();
      }
      if (willBeActive && (timeChanged || becomesActive)) {
        await checkConflict(tx, userId, newStart, newEnd, id);
        await checkBlockedTimeConflict(tx, userId, newStart, newEnd);
      }

      const location = dto.locationId ? await validateLocation(tx, dto.locationId, userId) : undefined;
      if (dto.typeId) await validateType(tx, dto.typeId, userId);
      const selectedReminder = dto.reminderId !== undefined
        ? await validateReminder(tx, dto.reminderId, userId, existing.patientId, id)
        : null;
      const doctorName = await getDoctorName(tx, userId);
      const effectiveLocation = location ?? existing.appointmentLocation;
      const meetingUrl = appointmentMeetingService.resolveMeetingUrl({
        location: effectiveLocation,
        previousLocation: existing.appointmentLocation,
        existingUrl: existing.meetingUrl,
        desiredUrl: dto.meetingUrl,
        appointmentId: id,
      });

      const hasReminderChange = dto.reminder !== undefined || dto.reminderId !== undefined;
      let effectiveReminderId: string | null | undefined;
      let createdReminder: Reminder | null = null;

      if (dto.reminderId !== undefined) {
        effectiveReminderId = dto.reminderId;
        if (existing.reminder && existing.reminder.id !== dto.reminderId) {
          if (existing.reminder.status === ReminderStatus.PENDING) {
            await tx.reminder.update({
              where: { id: existing.reminder.id },
              data: { status: ReminderStatus.CANCELLED, appointmentId: null },
            });
          } else {
            await tx.reminder.update({ where: { id: existing.reminder.id }, data: { appointmentId: null } });
          }
        }
      } else if (hasReminderChange) {
        const reminderResult = await handleReminderUpdate(dto, existing, userId, tx);
        effectiveReminderId = reminderResult.reminderId;
        createdReminder = reminderResult.reminder ?? null;
        if (createdReminder?.sendMode === ReminderMode.IMMEDIATE) {
          await enqueueImmediateReminder(createdReminder.id, tx);
        }
      }

      const updated = await appointmentRepository.update(id, {
        ...dto,
        ...(effectiveReminderId !== undefined && { reminderId: effectiveReminderId }),
        ...(meetingUrl !== existing.meetingUrl && meetingUrl !== undefined && { meetingUrl }),
      }, userId, tx);

      const diff = computeDiff(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, Object.keys(dto));
      await logAudit({
        entityType: EntityType.APPOINTMENT,
        entityId: id,
        userId,
        actionType: ActionType.UPDATE,
        description: `Cita actualizada para el paciente ${updated.patient.name} ${updated.patient.lastName}`,
        ...diff,
        tx,
        required: true,
      });

      const newlyLinkedReminder = createdReminder ?? selectedReminder;
      if (newlyLinkedReminder && newlyLinkedReminder.id !== existing.reminder?.id) {
        await tx.reminder.update({
          where: { id: newlyLinkedReminder.id },
          data: { appointmentId: id },
        });

        await logAudit({
           entityType: EntityType.REMINDER,
           entityId: newlyLinkedReminder.id,
           userId,
           actionType: ActionType.UPDATE,
          description: `Recordatorio vinculado a la cita del paciente ${updated.patient.name} ${updated.patient.lastName}`,
          affectedFields: [ 'appointmentId' ],
          fieldsBefore: { appointmentId: null },
          fieldsAfter: { appointmentId: id },
          tx,
          required: true,
        });
      }

      return renderLinkedReminder(
        updated,
        doctorName,
        tx,
      );
    }, { timeout: 10000 });

  },

  async setStatus(id: string, userId: string, status: AppointmentStatus): Promise<AppointmentWithRelations> {
    return prisma.$transaction(async (tx: TransactionClient) => {
      await withProviderLock(tx, userId);
      const appt = await appointmentRepository.findById(id, userId, false, tx);
      if (!ALLOWED_STATUS_TRANSITIONS[ appt.status ].includes(status)) {
        throw new AppointmentStatusTransitionError(appt.status, `change status to ${status}`);
      }
      const isPast = appt.startAt.getTime() < Date.now();
      if (isPast && (status === AppointmentStatus.SCHEDULED || status === AppointmentStatus.CONFIRMED)) {
        throw new PastAppointmentLockedError(id);
      }
      if (ACTIVE_STATUSES.has(status) && !ACTIVE_STATUSES.has(appt.status)) {
        await checkConflict(tx, userId, appt.startAt, appt.endAt, id);
        await checkBlockedTimeConflict(tx, userId, appt.startAt, appt.endAt);
      }
      const updated = await appointmentRepository.update(id, { status }, userId, tx);
      await logAudit({
        entityType: EntityType.APPOINTMENT,
        entityId: id,
        userId,
        actionType: ActionType.UPDATE,
        description: `Estado de la cita cambiado de ${appt.status} a ${status} para el paciente ${updated.patient.name} ${updated.patient.lastName}`,
        affectedFields: [ 'status' ],
        fieldsBefore: { status: appt.status },
        fieldsAfter: { status },
        tx,
        required: true,
      });
      logger.info({ appointmentId: id, previousStatus: appt.status, newStatus: status }, 'Appointment status changed');
      return updated;
    }, { timeout: 10000 });
  },

  async markPaid(id: string, userId: string): Promise<AppointmentWithRelations> {
    return prisma.$transaction(async (tx: TransactionClient) => {
      const appt = await appointmentRepository.findById(id, userId, false, tx);
      if (appt.paid) {
        throw new AppointmentStatusTransitionError(appt.status, 'mark as paid (already paid)');
      }
      if (!PAYABLE_STATUSES.has(appt.status)) {
        throw new AppointmentStatusTransitionError(appt.status, 'mark as paid');
      }

      const updated = await appointmentRepository.update(id, { paid: true }, userId, tx);
      await logAudit({
        entityType: EntityType.APPOINTMENT,
        entityId: id,
        userId,
        actionType: ActionType.UPDATE,
        description: `Cita del paciente ${updated.patient.name} ${updated.patient.lastName} marcada como pagada`,
        affectedFields: [ 'paid' ],
        fieldsBefore: { paid: false },
        fieldsAfter: { paid: true },
        tx,
        required: true,
      });
      return updated;
    }, { timeout: 10000 });
  },

  async delete(id: string, userId: string): Promise<{ id: string }> {
    return prisma.$transaction(async (tx: TransactionClient) => {
      const deleted = await appointmentRepository.delete(id, userId, tx);
      await logAudit({
        entityType: EntityType.APPOINTMENT,
        entityId: id,
        userId,
        actionType: ActionType.DELETE,
        description: `Cita eliminada para el paciente ${deleted.patient.name} ${deleted.patient.lastName}`,
        affectedFields: [ 'isDeleted' ],
        fieldsBefore: { isDeleted: false },
        fieldsAfter: { isDeleted: true },
        tx,
        required: true,
      });
      logger.info({ appointmentId: id, userId }, 'Appointment deleted');
      return { id };
    }, { timeout: 10000 });
  },

  async restore(id: string, userId: string): Promise<AppointmentWithRelations> {
    return prisma.$transaction(async (tx: TransactionClient) => {
      await withProviderLock(tx, userId);
      const appt = await appointmentRepository.findById(id, userId, true, tx);
      // A restored active appointment occupies the calendar again, so it must not collide.
      if (ACTIVE_STATUSES.has(appt.status)) {
        await checkConflict(tx, userId, appt.startAt, appt.endAt, id);
        await checkBlockedTimeConflict(tx, userId, appt.startAt, appt.endAt);
      }
      const restored = await appointmentRepository.restore(id, userId, tx);
      await logAudit({
        entityType: EntityType.APPOINTMENT,
        entityId: id,
        userId,
        actionType: ActionType.RESTORE,
        description: `Cita restaurada para el paciente ${restored.patient.name} ${restored.patient.lastName}`,
        affectedFields: [ 'isDeleted' ],
        fieldsBefore: { isDeleted: true },
        fieldsAfter: { isDeleted: false },
        tx,
        required: true,
      });
      logger.info({ appointmentId: id, userId }, 'Appointment restored');
      return restored;
    }, { timeout: 10000 });
  },
};
