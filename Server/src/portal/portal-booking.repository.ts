import { RecordSource } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { ACTIVE_STATUSES } from '../appointments/appointment-status.js';

export const PORTAL_APPOINTMENTS_LIMIT = 50;

export const portalAppointmentSelect = {
  id: true,
  startAt: true,
  endAt: true,
  status: true,
  price: true,
  appointmentType: { select: { name: true } },
  appointmentLocation: { select: { name: true, address: true, instructions: true } },
} as const;

const upcomingActive = (now: Date) => ({
  isDeleted: false,
  status: { in: [ ...ACTIVE_STATUSES ] },
  endAt: { gt: now },
});

export const portalBookingRepository = {
  /** Upcoming active appointments this patient booked through the portal (the per-patient cap). */
  async countUpcomingPortal(userId: string, patientId: string, now: Date, tx: TransactionClient): Promise<number> {
    return tx.appointment.count({
      where: { userId, patientId, source: RecordSource.PORTAL, ...upcomingActive(now), startAt: { gt: now } },
    });
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
