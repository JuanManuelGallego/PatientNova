import { AppointmentStatus } from '@prisma/client';
import { appointmentRepository } from './appointment.repository.js';
import { AppointmentStatusTransitionError } from '../utils/errors.js';

/** Statuses from which an appointment can be paid */
const PAYABLE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
]);

/** Statuses from which an appointment can be confirmed (only freshly scheduled) */
const CONFIRMABLE_STATUSES = new Set<AppointmentStatus>([AppointmentStatus.SCHEDULED]);

/** Statuses from which an appointment can be cancelled (not already cancelled/completed) */
const CANCELLABLE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
]);

export const appointmentService = {
  create: appointmentRepository.create.bind(appointmentRepository),
  findById: appointmentRepository.findById.bind(appointmentRepository),
  findMany: appointmentRepository.findMany.bind(appointmentRepository),
  update: appointmentRepository.update.bind(appointmentRepository),
  delete: appointmentRepository.delete.bind(appointmentRepository),
  getStats: appointmentRepository.getStats.bind(appointmentRepository),

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
