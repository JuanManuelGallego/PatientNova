import { AppointmentStatus, type AppointmentLocation, type Reminder } from '../../generated/prisma/client.ts';
import { appointmentRepository } from './appointment.repository.js';
import { AppointmentConflictError, AppointmentPatientNotFoundError, AppointmentReminderNotFoundError, AppointmentStatusTransitionError, AppointmentTypeNotFoundError, LocationNotFoundError } from '../utils/errors.js';
import type { CreateAppointmentDto, UpdateAppointmentDto } from './appointment.schemas.ts';
import { googleMeetService } from '../google/google-meet.service.ts';
import { prisma } from '../prisma/prismaClient.ts';
import { logger } from '../utils/logger.ts';

/** Statuses from which an appointment can be paid */
const PAYABLE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
]);

/** Statuses from which an appointment can be confirmed (only freshly scheduled) */
const CONFIRMABLE_STATUSES = new Set<AppointmentStatus>([ AppointmentStatus.SCHEDULED ]);

/** Statuses from which an appointment can be cancelled (not already cancelled/completed) */
const CANCELLABLE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
]);

const validatePatient = async (patientId: string, userId: string) => {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, userId } });
  if (!patient) throw new AppointmentPatientNotFoundError(patientId);

  return patient;
}

const validateLocation = async (locationId: string): Promise<AppointmentLocation> => {
  const location = await prisma.appointmentLocation.findUnique({ where: { id: locationId } });

  if (!location)
    throw new LocationNotFoundError(locationId)

  return location as AppointmentLocation
}

const validateType = async (typeId: string) => {
  const type = await prisma.appointmentType.findUnique({ where: { id: typeId } });

  if (!type)
    throw new AppointmentTypeNotFoundError(typeId);
}

const validateReminder = async (reminderId: string | null | undefined): Promise<Reminder | null> => {
  if (reminderId) {
    const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } });
    if (!reminder) throw new AppointmentReminderNotFoundError(reminderId);
    return reminder;
  }
  return null;
}

export async function checkConflict(patientId: string, startAt: string | Date, endAt: string | Date, excludeId?: string): Promise<void> {
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


export const appointmentService = {
  findById: appointmentRepository.findById.bind(appointmentRepository),
  findMany: appointmentRepository.findMany.bind(appointmentRepository),
  delete: appointmentRepository.delete.bind(appointmentRepository),
  softDelete: appointmentRepository.delete.bind(appointmentRepository),
  restore: appointmentRepository.restore.bind(appointmentRepository),
  getStats: appointmentRepository.getStats.bind(appointmentRepository),

  async create(dto: CreateAppointmentDto, userId: string) {
    await validateType(dto.typeId);
    const reminder = await validateReminder(dto.reminderId);
    const patient = await validatePatient(dto.patientId, userId);

    const location = await validateLocation(dto.locationId)

    if (!dto.meetingUrl && location?.isVirtual) {
      const space = await googleMeetService.createMeetingSpace();
      dto.meetingUrl = space.meetingUrl;
      if (reminder) {
        try {
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: {
              contentVariables: {
                ...(reminder.contentVariables as Record<string, any>),
                "5": space.meetingUrl,
              }
            }
          });
        } catch (error) {
          logger.error({ reminderId: reminder.id, error }, "Failed to update reminder with meeting URL");
        }
      }
    }

    await checkConflict(dto.patientId, dto.startAt, dto.endAt);
    return appointmentRepository.create(dto, patient.userId);
  },

  async update(id: string, dto: UpdateAppointmentDto, userId: string) {
    const existing = await appointmentRepository.findById(id, userId);

    // Check for conflicts when time changes
    if (dto.startAt !== undefined || dto.endAt !== undefined) {
      const newStart = dto.startAt ?? existing.startAt;
      const newEnd = dto.endAt ?? existing.endAt;
      await checkConflict(existing.patientId, newStart, newEnd, id);
    }

    if (dto.locationId) {
      await validateLocation(dto.locationId);
    }

    if (dto.reminderId) {
      await validateReminder(dto.reminderId)
    }

    return appointmentRepository.update(id, dto);
  },

  async markPaid(id: string, userId: string) {
    const appt = await appointmentRepository.findById(id, userId);
    if (!PAYABLE_STATUSES.has(appt.status)) {
      throw new AppointmentStatusTransitionError(appt.status, 'mark as paid');
    }
    return appointmentRepository.markPaid(id, userId);
  },

  async markConfirmed(id: string, userId: string) {
    const appt = await appointmentRepository.findById(id, userId);
    if (!CONFIRMABLE_STATUSES.has(appt.status)) {
      throw new AppointmentStatusTransitionError(appt.status, 'confirm');
    }
    return appointmentRepository.markConfirmed(id, userId);
  },

  async markCancelled(id: string, userId: string) {
    const appt = await appointmentRepository.findById(id, userId);
    if (!CANCELLABLE_STATUSES.has(appt.status)) {
      throw new AppointmentStatusTransitionError(appt.status, 'cancel');
    }
    return appointmentRepository.markCancelled(id, userId);
  },
};
