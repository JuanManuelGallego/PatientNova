import { RecordSource } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { ACTIVE_STATUSES } from '../appointments/appointment-status.js';

export const PORTAL_APPOINTMENTS_LIMIT = 50;

const bookableFields = { bookableOnline: true, isActive: true, isDeleted: true } as const;

/** Read for patient-facing DTOs; the bookable flags feed the action flags and never reach the response. */
export const portalAppointmentSelect = {
  id: true,
  startAt: true,
  endAt: true,
  status: true,
  price: true,
  isDeleted: true,
  source: true,
  patientRescheduleCount: true,
  meetingUrl: true,
  meetingStatus: true,
  appointmentType: { select: { name: true, defaultDuration: true, ...bookableFields } },
  appointmentLocation: { select: { name: true, address: true, instructions: true, isVirtual: true, ...bookableFields } },
} as const;

const upcomingActive = (now: Date) => ({
  isDeleted: false,
  status: { in: [ ...ACTIVE_STATUSES ] },
  endAt: { gt: now },
});

export const portalBookingRepository = {
  async countUpcomingPortal(userId: string, patientId: string, now: Date, tx: TransactionClient): Promise<number> {
    return tx.appointment.count({
      where: { userId, patientId, source: RecordSource.PORTAL, ...upcomingActive(now), startAt: { gt: now } },
    });
  },

  /** The session patient's own appointment, or null; callers answer every miss with the same 404. */
  async findOwn(userId: string, patientId: string, appointmentId: string, tx: TransactionClient) {
    return tx.appointment.findFirst({
      where: { id: appointmentId, userId, patientId },
      select: { ...portalAppointmentSelect, typeId: true, locationId: true, patientId: true },
    });
  },

  async findForDto(appointmentId: string, tx: TransactionClient) {
    return tx.appointment.findUniqueOrThrow({ where: { id: appointmentId }, select: portalAppointmentSelect });
  },

  async listUpcoming(userId: string, patientId: string, now: Date) {
    return prisma.appointment.findMany({
      where: { userId, patientId, ...upcomingActive(now) },
      select: portalAppointmentSelect,
      orderBy: { startAt: 'asc' },
      take: PORTAL_APPOINTMENTS_LIMIT,
    });
  },
};
