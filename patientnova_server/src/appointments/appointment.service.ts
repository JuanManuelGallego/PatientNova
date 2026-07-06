import { AppointmentStatus, type AppointmentLocation, type Reminder } from '../../generated/prisma/client.ts';
import { appointmentRepository } from './appointment.repository.js';
import {
  AppointmentConflictError,
  AppointmentPatientNotFoundError,
  AppointmentReminderNotFoundError,
  AppointmentStatusTransitionError,
  AppointmentTypeNotFoundError,
  LocationNotFoundError,
} from '../utils/errors.js';
import type { CreateAppointmentDto, UpdateAppointmentDto, ListAppointmentsQuery, AppointmentStatsQuery } from './appointment.schemas.ts';
import { googleMeetService } from '../google/google-meet.service.ts';
import { prisma } from '../prisma/prismaClient.ts';
import { logger } from '../utils/logger.ts';
import type { AppointmentWithRelations, AppointmentStats } from '../utils/types.ts';
import type { Paginated } from '../utils/pagination.ts';

const VALID_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.SCHEDULED]: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.CONFIRMED]: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.NO_SHOW]: [AppointmentStatus.CANCELLED],
};

const PAYABLE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
]);

function validateStatusTransition(current: AppointmentStatus, next: AppointmentStatus): void {
  const allowed = VALID_STATUS_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new AppointmentStatusTransitionError(current, `change status to "${next}"`);
  }
}

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
    await validateType(dto.typeId);
    await checkConflict(dto.patientId, dto.startAt, dto.endAt); 

    const reminder = await validateReminder(dto.reminderId);
    const patient = await validatePatient(dto.patientId, userId);
    const location = await validateLocation(dto.locationId);
    
    if (!dto.meetingUrl && location?.isVirtual) {
      const space = await googleMeetService.createMeetingSpace();
      dto.meetingUrl = space.meetingUrl;
      logger.info({ appointmentId: dto.patientId, meetingUrl: space.meetingUrl }, 'Generated meeting URL for virtual appointment');

      if (reminder) {
        try {
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: {
              contentVariables: {
                ...(reminder.contentVariables as Record<string, any>),
                '5': space.meetingUrl,
              },
            },
          });
        } catch (error) {
          logger.error({ reminderId: reminder.id, error }, 'Failed to update reminder with meeting URL');
        }
      }
    }
    
    const created = await appointmentRepository.create(dto, patient.userId);
    logger.info({ appointmentId: created.id, patientId: dto.patientId, userId, startAt: dto.startAt }, 'Appointment created');
    return created;
  },

  async update(id: string, dto: UpdateAppointmentDto, userId: string): Promise<AppointmentWithRelations> {
    const existing = await appointmentRepository.findByIdWithRelations(id, userId);

    if (dto.status !== undefined && dto.status !== existing.status) {
      validateStatusTransition(existing.status, dto.status);
    }

    if (dto.startAt !== undefined || dto.endAt !== undefined) {
      const newStart = dto.startAt ?? existing.startAt;
      const newEnd = dto.endAt ?? existing.endAt;
      await checkConflict(existing.patientId, newStart, newEnd, id);
    }

    let location: AppointmentLocation | undefined;
    if (dto.locationId) {
      location = await validateLocation(dto.locationId);
    }

    let reminder: Reminder | null = null;
    if (dto.reminderId) {
      reminder = await validateReminder(dto.reminderId);
    }

    const effectiveIsVirtual = location?.isVirtual ?? existing.appointmentLocation?.isVirtual;
    const targetReminder = reminder ?? existing.reminder;

    if (effectiveIsVirtual && !dto.meetingUrl && !existing.meetingUrl) {
      const space = await googleMeetService.createMeetingSpace();
      dto.meetingUrl = space.meetingUrl;
      logger.info({ appointmentId: id, meetingUrl: space.meetingUrl }, 'Generated meeting URL for virtual appointment');

      if (targetReminder) {
        try {
          await prisma.reminder.update({
            where: { id: targetReminder.id },
            data: {
              contentVariables: {
                ...(targetReminder.contentVariables as Record<string, any>),
                '5': space.meetingUrl,
              },
            },
          });
        } catch (error) {
          logger.error({ reminderId: targetReminder.id, error }, 'Failed to update reminder with meeting URL');
        }
      }
    } else if (location && !location.isVirtual && existing.meetingUrl) {
      dto.meetingUrl = undefined;
      logger.info({ appointmentId: id }, 'Cleared meeting URL (switched to in-person)');

      if (targetReminder) {
        const vars = { ...(targetReminder.contentVariables as Record<string, any>) };
        delete vars['5'];
        try {
          await prisma.reminder.update({
            where: { id: targetReminder.id },
            data: { contentVariables: vars },
          });
        } catch (error) {
          logger.error({ reminderId: targetReminder.id, error }, 'Failed to clear meeting URL from reminder');
        }
      }
    }

    return await appointmentRepository.update(id, dto);
  },

  async setStatus(id: string, userId: string, status: AppointmentStatus): Promise<AppointmentWithRelations> {
    const appt = await appointmentRepository.findById(id, userId);
    validateStatusTransition(appt.status, status);
    logger.info({ appointmentId: id, previousStatus: appt.status, newStatus: status }, 'Appointment status changed');
    return appointmentRepository.update(id, { status });
  },

  async markPaid(id: string, userId: string): Promise<AppointmentWithRelations> {
    const appt = await appointmentRepository.findById(id, userId);
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
    await appointmentRepository.findById(id, userId);
    const restored = await appointmentRepository.restore(id, userId);
    logger.info({ appointmentId: id, userId }, 'Appointment restored');
    return restored;
  },
};
