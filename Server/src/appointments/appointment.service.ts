import { AppointmentStatus, ReminderStatus, type AppointmentLocation, type Reminder } from '../../generated/prisma/client.ts';
import { appointmentRepository } from './appointment.repository.js';
import {
  AppointmentConflictError,
  AppointmentPatientNotFoundError,
  AppointmentReminderNotFoundError,
  AppointmentStatusTransitionError,
} from './appointment.errors.js';
import { LocationNotFoundError, ReminderNotCancellableError } from '../utils/errors/errors.js';
import { AppointmentTypeNotFoundError } from '../appointment-types/appointment-type.errors.js';
import type { CreateAppointmentDto, UpdateAppointmentDto, ListAppointmentsQuery, AppointmentStatsQuery } from './appointment.schemas.ts';
import { appointmentMeetingService } from './appointment-meeting.service.ts';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.ts';
import { logger } from '../utils/api/logger.ts';
import type { AppointmentWithRelations, AppointmentStats } from './appointment.types.ts';
import type { Paginated } from '../utils/api/pagination.ts';

const PAYABLE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
]);

const ALLOWED_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.SCHEDULED]: [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.SCHEDULED,
  ],
  [AppointmentStatus.CANCELLED]: [ AppointmentStatus.CANCELLED, AppointmentStatus.SCHEDULED ],
  [AppointmentStatus.COMPLETED]: [ AppointmentStatus.COMPLETED, AppointmentStatus.SCHEDULED ],
  [AppointmentStatus.NO_SHOW]: [
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.SCHEDULED,
  ],
};

async function validatePatient(patientId: string, userId: string) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, userId } });
  if (!patient) throw new AppointmentPatientNotFoundError(patientId);
  return patient;
}

async function validateLocation(locationId: string): Promise<AppointmentLocation> {
  const location = await prisma.appointmentLocation.findUnique({ where: { id: locationId } });
  if (!location) throw new LocationNotFoundError(locationId);
  return location as AppointmentLocation;
}

async function validateType(typeId: string) {
  const type = await prisma.appointmentType.findUnique({ where: { id: typeId } });
  if (!type) throw new AppointmentTypeNotFoundError(typeId);
}

async function validateReminder(reminderId: string | null | undefined): Promise<Reminder | null> {
  if (reminderId) {
    const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } });
    if (!reminder) throw new AppointmentReminderNotFoundError(reminderId);
    return reminder;
  }
  return null;
}

async function handleReminderUpdate(
  dto: UpdateAppointmentDto,
  existing: AppointmentWithRelations,
  userId: string,
  tx: TransactionClient,
): Promise<{ reminderId?: string | null | undefined; reminder?: Reminder | null }> {
  if (dto.reminder === null && existing.reminder) {
    if (existing.reminder.status !== ReminderStatus.PENDING) {
      throw new ReminderNotCancellableError(existing.reminder.status);
    }
    await tx.reminder.update({
      where: { id: existing.reminder.id },
      data: { status: ReminderStatus.CANCELLED },
    });
    logger.info({ reminderId: existing.reminder.id }, 'Reminder cancelled (atomic with appointment update)');
    return { reminderId: null };
  }

  if (dto.reminder && !existing.reminder) {
    const createdReminder = await tx.reminder.create({
      data: {
        channel: dto.reminder.channel,
        to: dto.reminder.to,
        sendMode: dto.reminder.sendMode,
        contentSid: dto.reminder.contentSid || null,
        ...(dto.reminder.contentVariables && { contentVariables: dto.reminder.contentVariables }),
        sendAt: dto.reminder.sendAt ? new Date(dto.reminder.sendAt) : new Date(),
        status: dto.reminder.status ?? ReminderStatus.PENDING,
        body: dto.reminder.body || null,
        patientId: existing.patientId,
        userId,
      },
    });
    logger.info({ reminderId: createdReminder.id }, 'Reminder created (atomic with appointment update)');
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
    logger.info({ reminderId: existing.reminder.id }, 'Reminder updated (atomic with appointment update)');
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
      status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
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
    return prisma.$transaction(async (tx: TransactionClient) => {
      const [existingReminder, patient, location] = await Promise.all([
        dto.reminderId ? validateReminder(dto.reminderId) : Promise.resolve(null),
        validatePatient(dto.patientId, userId),
        validateLocation(dto.locationId),
      ]);

      await Promise.all([
        validateType(dto.typeId),
        checkConflict(dto.patientId, dto.startAt, dto.endAt),
      ]);

      let createdReminder: Reminder | null = null;

      if (dto.reminder) {
        createdReminder = await tx.reminder.create({
          data: {
            channel: dto.reminder.channel,
            to: dto.reminder.to,
            sendMode: dto.reminder.sendMode,
            contentSid: dto.reminder.contentSid || null,
            ...(dto.reminder.contentVariables && { contentVariables: dto.reminder.contentVariables }),
            sendAt: dto.reminder.sendAt ? new Date(dto.reminder.sendAt) : new Date(),
            status: dto.reminder.status ?? ReminderStatus.PENDING,
            body: dto.reminder.body || null,
            patientId: dto.patientId,
            userId,
          },
        });
        logger.info({ reminderId: createdReminder.id, userId, mode: dto.reminder.sendMode }, 'Reminder created (atomic with appointment)');
      }

      const reminderId = createdReminder?.id ?? existingReminder?.id ?? dto.reminderId ?? null;

      const created = await appointmentRepository.create(
        { ...dto, reminderId: reminderId ?? undefined },
        patient.userId,
        tx,
      );

      const meetingUrl = await appointmentMeetingService.resolveMeetingUrl(
        { location, existingUrl: created.meetingUrl, desiredUrl: dto.meetingUrl, reminder: createdReminder ?? existingReminder, appointmentId: created.id },
        tx,
      );

      let result = created;
      if (meetingUrl !== created.meetingUrl) {
        result = await appointmentRepository.update(created.id, { meetingUrl }, tx);
      }

      if (createdReminder) {
        await tx.reminder.update({
          where: { id: createdReminder.id },
          data: { appointmentId: created.id },
        });
      }

      logger.info({ appointmentId: created.id, patientId: dto.patientId, userId, startAt: dto.startAt }, 'Appointment created');
      return result;
    }, { timeout: 10000 });
  },

  async update(id: string, dto: UpdateAppointmentDto, userId: string): Promise<AppointmentWithRelations> {
    const existing = await appointmentRepository.findByIdWithRelations(id, userId);

    if (dto.startAt !== undefined || dto.endAt !== undefined) {
      const newStart = dto.startAt ?? existing.startAt;
      const newEnd = dto.endAt ?? existing.endAt;
      await checkConflict(existing.patientId, newStart, newEnd, id);
    }

    let location: AppointmentLocation | undefined;
    if (dto.locationId) {
      location = await validateLocation(dto.locationId);
    }

    const hasReminderChange = dto.reminder !== undefined || dto.reminderId !== undefined;

    return prisma.$transaction(async (tx: TransactionClient) => {
      let effectiveReminderId: string | null | undefined;
      let createdReminder: Reminder | null = null;

      if (hasReminderChange) {
        const reminderResult = await handleReminderUpdate(dto, existing, userId, tx);
        effectiveReminderId = reminderResult.reminderId;
        createdReminder = reminderResult.reminder ?? null;
      }

      const reminderForUrl = createdReminder ?? existing.reminder;
      const effectiveLocation = location ?? existing.appointmentLocation;
      const meetingUrl = await appointmentMeetingService.resolveMeetingUrl(
        { location: effectiveLocation, existingUrl: existing.meetingUrl, desiredUrl: dto.meetingUrl, reminder: reminderForUrl, appointmentId: id },
        tx,
      );

      const updated = await appointmentRepository.update(id, {
        ...dto,
        ...(effectiveReminderId !== undefined && { reminderId: effectiveReminderId }),
        ...(meetingUrl !== existing.meetingUrl && { meetingUrl }),
      }, tx);

      if (createdReminder) {
        await tx.reminder.update({
          where: { id: createdReminder.id },
          data: { appointmentId: id },
        });
      }

      return updated;
    }, { timeout: 10000 });
  },

  async setStatus(id: string, userId: string, status: AppointmentStatus): Promise<AppointmentWithRelations> {
    const appt = await appointmentRepository.findById(id, userId);
    if (!ALLOWED_STATUS_TRANSITIONS[ appt.status ].includes(status)) {
      throw new AppointmentStatusTransitionError(appt.status, `change status to ${status}`);
    }
    logger.info({ appointmentId: id, previousStatus: appt.status, newStatus: status }, 'Appointment status changed');
    return appointmentRepository.update(id, { status });
  },

  async markPaid(id: string, userId: string): Promise<AppointmentWithRelations> {
    const appt = await appointmentRepository.findById(id, userId);
    if (appt.paid) {
      throw new AppointmentStatusTransitionError(appt.status, 'mark as paid (already paid)');
    }
    if (!PAYABLE_STATUSES.has(appt.status)) {
      throw new AppointmentStatusTransitionError(appt.status, 'mark as paid');
    }

    return await appointmentRepository.update(id, { paid: true });
  },

  async delete(id: string, userId: string): Promise<{ id: string }> {
    await appointmentRepository.findById(id, userId);
    await appointmentRepository.delete(id, userId);
    logger.info({ appointmentId: id, userId }, 'Appointment deleted');
    return { id };
  },

  async restore(id: string, userId: string): Promise<AppointmentWithRelations> {
    await appointmentRepository.findById(id, userId, true);
    const restored = await appointmentRepository.restore(id, userId);
    logger.info({ appointmentId: id, userId }, 'Appointment restored');
    return restored;
  },
};
