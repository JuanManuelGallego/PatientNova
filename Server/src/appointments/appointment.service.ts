import { AppointmentStatus, Channel, ReminderMode, ReminderStatus, type AppointmentLocation, type AppointmentType, type Patient, type Reminder } from '../../generated/prisma/client.ts';
import { fromPrisma } from 'pg-boss';
import { appointmentRepository } from './appointment.repository.js';
import {
  AppointmentConflictError,
  AppointmentPatientNotFoundError,
  AppointmentReminderNotFoundError,
  AppointmentStatusTransitionError,
  AppointmentBlockedTimeConflictError,
  PastAppointmentLockedError,
} from './appointment.errors.js';
import { LocationNotFoundError } from '../utils/errors/errors.js';
import { AppointmentTypeNotFoundError } from '../appointment-types/appointment-type.errors.js';
import type { CreateAppointmentDto, UpdateAppointmentDto, ListAppointmentsQuery, AppointmentStatsQuery } from './appointment.schemas.ts';
import { appointmentMeetingService } from './appointment-meeting.service.ts';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.ts';
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

async function validatePatient(patientId: string, userId: string): Promise<Patient> {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, userId } });
  if (!patient) throw new AppointmentPatientNotFoundError(patientId);
  return patient;
}

async function validateLocation(locationId: string, userId: string): Promise<AppointmentLocation> {
  const location = await prisma.appointmentLocation.findFirst({ where: { id: locationId, userId, isDeleted: false } });
  if (!location) throw new LocationNotFoundError(locationId);
  return location as AppointmentLocation;
}

async function validateType(typeId: string, userId: string): Promise<AppointmentType> {
  const type = await prisma.appointmentType.findFirst({ where: { id: typeId, userId, isDeleted: false } });
  if (!type) throw new AppointmentTypeNotFoundError(typeId);
  return type;
}

async function validateReminder(
  reminderId: string | null | undefined,
  userId: string,
  patientId: string,
  appointmentId?: string,
): Promise<Reminder | null> {
  if (reminderId) {
    const reminder = await prisma.reminder.findFirst({
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

async function getDoctorName(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
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
    });

    logger.info({ reminderId: existing.reminder.id }, 'Reminder updated');
  }

  return {};
}

async function checkConflict(
  patientId: string,
  startAt: string | Date,
  endAt: string | Date,
  excludeId?: string,
): Promise<void> {
  const conflict = await prisma.appointment.findFirst({
    where: {
      patientId,
      isDeleted: false,
      status: { in: [ AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED ] },
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
  userId: string,
  startAt: string | Date,
  endAt: string | Date,
): Promise<void> {
  const overlap = await blockedTimeRepository.hasBlockedTimeOverlap(userId, new Date(startAt), new Date(endAt));
  if (overlap) {
    throw new AppointmentBlockedTimeConflictError(overlap.description, overlap.startTimeUtc, overlap.endTimeUtc);
  }
}

async function enqueueImmediateReminder(reminderId: string, tx: TransactionClient): Promise<void> {
  if (!config.scheduler.enabled) return;
  await getBoss().send(REMINDER_QUEUE, { reminderId }, { db: fromPrisma(tx) });
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
    const [ existingReminder, patient, location, , doctorName ] = await Promise.all([
      validateReminder(dto.reminderId, userId, dto.patientId),
      validatePatient(dto.patientId, userId),
      validateLocation(dto.locationId, userId),
      validateType(dto.typeId, userId),
      getDoctorName(userId),
    ]);
    await Promise.all([
      checkConflict(dto.patientId, dto.startAt, dto.endAt),
      checkBlockedTimeConflict(userId, dto.startAt, dto.endAt),
    ]);
    const meetingUrl = appointmentMeetingService.resolveMeetingUrl({
      location,
      existingUrl: null,
      desiredUrl: dto.meetingUrl,
      appointmentId: 'new',
    });
    return prisma.$transaction(async (tx: TransactionClient) => {

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
        });
      }

      logger.info({ appointmentId: created.id, patientId: patient.id, userId, startAt: created.startAt }, 'Appointment created');

      return renderLinkedReminder(
        created,
        doctorName,
        tx,
      );
    }, { timeout: 10000 });

  },

  async update(id: string, dto: UpdateAppointmentDto, userId: string): Promise<AppointmentWithRelations> {
    const existing = await appointmentRepository.findByIdWithRelations(id, userId);

    const newStatus = dto.status ?? existing.status;
    const isPast = existing.endAt.getTime() < Date.now();
    if (isPast && (newStatus === AppointmentStatus.SCHEDULED || newStatus === AppointmentStatus.CONFIRMED)) {
      throw new PastAppointmentLockedError(id);
    }

    if (dto.startAt !== undefined || dto.endAt !== undefined) {
      const newStart = dto.startAt ?? existing.startAt;
      const newEnd = dto.endAt ?? existing.endAt;
      await Promise.all([
        checkConflict(existing.patientId, newStart, newEnd, id),
        checkBlockedTimeConflict(userId, newStart, newEnd),
      ]);
    }

    const [ location, , selectedReminder, doctorName ] = await Promise.all([
      dto.locationId ? validateLocation(dto.locationId, userId) : Promise.resolve(undefined),
      dto.typeId ? validateType(dto.typeId, userId) : Promise.resolve(undefined),
      dto.reminderId !== undefined
        ? validateReminder(dto.reminderId, userId, existing.patientId, id)
        : Promise.resolve(null),
      getDoctorName(userId),
    ]);
    const effectiveLocation = location ?? existing.appointmentLocation;
    const meetingUrl = appointmentMeetingService.resolveMeetingUrl({
      location: effectiveLocation,
      previousLocation: existing.appointmentLocation,
      existingUrl: existing.meetingUrl,
      desiredUrl: dto.meetingUrl,
      appointmentId: id,
    });

    const hasReminderChange = dto.reminder !== undefined || dto.reminderId !== undefined;
    return prisma.$transaction(async (tx: TransactionClient) => {
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
      }, tx);

      const diff = computeDiff(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, Object.keys(dto));
      await logAudit({
        entityType: EntityType.APPOINTMENT,
        entityId: id,
        userId,
        actionType: ActionType.UPDATE,
        description: `Cita actualizada para el paciente ${updated.patient.name} ${updated.patient.lastName}`,
        ...diff,
        tx,
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
    const appt = await appointmentRepository.findById(id, userId);
    if (!ALLOWED_STATUS_TRANSITIONS[ appt.status ].includes(status)) {
      throw new AppointmentStatusTransitionError(appt.status, `change status to ${status}`);
    }
    const isPast = appt.startAt.getTime() < Date.now();
    if (isPast && (status === AppointmentStatus.SCHEDULED || status === AppointmentStatus.CONFIRMED)) {
      throw new PastAppointmentLockedError(id);
    }
    const updated = await appointmentRepository.update(id, { status });
    await logAudit({
      entityType: EntityType.APPOINTMENT,
      entityId: id,
      userId,
      actionType: ActionType.UPDATE,
      description: `Estado de la cita cambiado de ${appt.status} a ${status} para el paciente ${updated.patient.name} ${updated.patient.lastName}`,
      affectedFields: [ 'status' ],
      fieldsBefore: { status: appt.status },
      fieldsAfter: { status },
    });
    logger.info({ appointmentId: id, previousStatus: appt.status, newStatus: status }, 'Appointment status changed');
    return updated;
  },

  async markPaid(id: string, userId: string): Promise<AppointmentWithRelations> {
    const appt = await appointmentRepository.findById(id, userId);
    if (appt.paid) {
      throw new AppointmentStatusTransitionError(appt.status, 'mark as paid (already paid)');
    }
    if (!PAYABLE_STATUSES.has(appt.status)) {
      throw new AppointmentStatusTransitionError(appt.status, 'mark as paid');
    }

    const updated = await appointmentRepository.update(id, { paid: true });
    await logAudit({
      entityType: EntityType.APPOINTMENT,
      entityId: id,
      userId,
      actionType: ActionType.UPDATE,
      description: `Cita del paciente ${updated.patient.name} ${updated.patient.lastName} marcada como pagada`,
      affectedFields: [ 'paid' ],
      fieldsBefore: { paid: false },
      fieldsAfter: { paid: true },
    });
    return updated;
  },

  async delete(id: string, userId: string): Promise<{ id: string }> {
    const deleted = await appointmentRepository.delete(id, userId);
    await logAudit({
      entityType: EntityType.APPOINTMENT,
      entityId: id,
      userId,
      actionType: ActionType.DELETE,
      description: `Cita eliminada para el paciente ${deleted.patient.name} ${deleted.patient.lastName}`,
      affectedFields: [ 'isDeleted' ],
      fieldsBefore: { isDeleted: false },
      fieldsAfter: { isDeleted: true },
    });
    logger.info({ appointmentId: id, userId }, 'Appointment deleted');
    return { id };
  },

  async restore(id: string, userId: string): Promise<AppointmentWithRelations> {
    await appointmentRepository.findById(id, userId, true);
    const restored = await appointmentRepository.restore(id, userId);
    await logAudit({
      entityType: EntityType.APPOINTMENT,
      entityId: id,
      userId,
      actionType: ActionType.RESTORE,
      description: `Cita restaurada para el paciente ${restored.patient.name} ${restored.patient.lastName}`,
      affectedFields: [ 'isDeleted' ],
      fieldsBefore: { isDeleted: true },
      fieldsAfter: { isDeleted: false },
    });
    logger.info({ appointmentId: id, userId }, 'Appointment restored');
    return restored;
  },
};
