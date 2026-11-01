import { prisma } from '../utils/prisma/prisma-client.js';
import { ACTIVE_STATUSES } from '../appointments/appointment-status.js';
import type { Interval } from './slot-engine.js';

const MINUTE_MS = 60_000;

const bookable = { bookableOnline: true, isActive: true, isDeleted: false } as const;

export type ProviderImageKind = 'avatar' | 'logo';

export const publicBookingRepository = {
  async findProviderBySlug(slug: string) {
    return prisma.user.findUnique({
      where: { bookingSlug: slug },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        timezone: true,
        slotIntervalMinutes: true,
        bufferMinutes: true,
        minLeadMinutes: true,
        maxHorizonDays: true,
      },
    });
  },

  async getImages(userId: string) {
    return prisma.user.findUnique({ where: { id: userId }, select: { avatar: true, logo: true } });
  },

  async listBookableTypes(userId: string) {
    return prisma.appointmentType.findMany({
      where: { userId, ...bookable },
      select: { id: true, name: true, description: true, defaultDuration: true, defaultPrice: true },
      orderBy: { name: 'asc' },
    });
  },

  async findBookableType(userId: string, typeId: string) {
    return prisma.appointmentType.findFirst({
      where: { id: typeId, userId, ...bookable },
      select: { id: true, defaultDuration: true },
    });
  },

  async listBookableLocations(userId: string) {
    return prisma.appointmentLocation.findMany({
      where: { userId, ...bookable, isVirtual: false },
      select: { id: true, name: true, address: true },
      orderBy: { name: 'asc' },
    });
  },

  async loadBusy(userId: string, start: Date, end: Date, bufferMinutes: number): Promise<{ appointments: Interval[]; blocked: Interval[] }> {
    const bufferMs = bufferMinutes * MINUTE_MS;
    const [ appointments, blocked ] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          userId,
          isDeleted: false,
          status: { in: [ ...ACTIVE_STATUSES ] },
          startAt: { lt: new Date(end.getTime() + bufferMs) },
          endAt: { gt: new Date(start.getTime() - bufferMs) },
        },
        select: { startAt: true, endAt: true },
      }),
      prisma.blockedTime.findMany({
        where: { userId, isDeleted: false, startTimeUtc: { lt: end }, endTimeUtc: { gt: start } },
        select: { startTimeUtc: true, endTimeUtc: true },
      }),
    ]);
    return {
      appointments: appointments.map((a) => ({ start: a.startAt, end: a.endAt })),
      blocked: blocked.map((b) => ({ start: b.startTimeUtc, end: b.endTimeUtc })),
    };
  },
};
