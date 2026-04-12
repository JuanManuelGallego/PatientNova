import { AppointmentStatus, Prisma, type Appointment } from '@prisma/client';
import { prisma } from '../prisma/prismaClient.js';
import {
  type CreateAppointmentDto,
  type UpdateAppointmentDto,
  type ListAppointmentsQuery,
  type AppointmentStatsQuery,
} from './appointment.schemas.js';
import { AppointmentPatientNotFoundError, AppointmentReminderNotFoundError, AppointmentNotFoundError } from '../utils/errors.js';
import { appointmentInclude, type AppointmentWithRelations, type PaginatedAppointments, type AppointmentStats } from '../utils/types.js';

/**
 * Returns the UTC start and end of "today" in the given IANA timezone.
 * Falls back to UTC if the timezone is invalid.
 */
function getTodayBoundsInTz(timezone: string): { start: Date; end: Date } {
  const tz = (() => { try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); return timezone; } catch { return 'UTC'; } })();
  const now = new Date();

  const fmt = (zone: string) =>
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: zone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    }).format(now).replace(' ', 'T');

  const localStr = fmt(tz);
  const utcStr = fmt('UTC');

  // UTC offset in ms: positive for zones ahead of UTC (e.g. UTC+5), negative for behind
  const offsetMs = new Date(localStr + 'Z').getTime() - new Date(utcStr + 'Z').getTime();

  // Today's date in the target timezone ("YYYY-MM-DD")
  const localDateStr = localStr.slice(0, 10);

  // Midnight of that date, expressed as UTC
  const startMs = new Date(localDateStr + 'T00:00:00.000Z').getTime() - offsetMs;

  return { start: new Date(startMs), end: new Date(startMs + 86_400_000 - 1) };
}

export const appointmentRepository = {
  async create(dto: CreateAppointmentDto, userId: string): Promise<AppointmentWithRelations> {
    const patient = await prisma.patient.findFirst({ where: { id: dto.patientId, userId } });
    if (!patient) throw new AppointmentPatientNotFoundError(dto.patientId);

    if (dto.reminderId) {
      const reminder = await prisma.reminder.findUnique({ where: { id: dto.reminderId } });
      if (!reminder) throw new AppointmentReminderNotFoundError(dto.reminderId);
    }

    return prisma.appointment.create({
      data: {
        startAt: dto.startAt,
        endAt: dto.endAt,
        timezone: dto.timezone || 'CST',
        price: dto.price,
        currency: dto.currency || 'COP',
        paid: dto.paid,
        locationId: dto.locationId,
        meetingUrl: dto.meetingUrl || null,
        notes: dto.notes || null,
        typeId: dto.typeId,
        status: dto.status,
        patientId: dto.patientId,
        ...(dto.reminderId && { reminder: { connect: { id: dto.reminderId } }, reminderId: dto.reminderId }),
      },
      include: appointmentInclude,
    });
  },

  async findById(id: string, userId: string): Promise<AppointmentWithRelations> {
    const appt = await prisma.appointment.findFirst({
      where: { id, patient: { userId } },
      include: appointmentInclude,
    });
    if (!appt) throw new AppointmentNotFoundError(id);
    return appt;
  },

  async findMany(query: ListAppointmentsQuery, userId: string, timezone = 'UTC'): Promise<PaginatedAppointments> {
    const { patientId, status, startAt, dateFrom, dateTo, paid, search, page, pageSize, orderBy, order, locationId, typeId } = query;
    const skip = (page - 1) * pageSize;
    const { start: todayStart, end: todayEnd } = getTodayBoundsInTz(timezone);


    const where: Prisma.AppointmentWhereInput = {
      patient: { userId },
      ...(patientId && { patientId }),
      ...(locationId && { locationId }),
      ...(typeId && { typeId }),
      ...(status && { status }),
      ...(paid !== undefined && { paid }),
      ...(startAt && {
        startAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      }),
      ...(search && {
        OR: [
          {
            patient: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ]
            }
          } ]
      }),
      ...(dateFrom || dateTo
        ? {
          startAt: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        }
        : {}),
    };

    const [ data, total ] = await prisma.$transaction([
      prisma.appointment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [ orderBy ]: order },
        include: appointmentInclude,
      }),
      prisma.appointment.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async update(id: string, dto: UpdateAppointmentDto, userId: string): Promise<AppointmentWithRelations> {
    await appointmentRepository.findById(id, userId);

    if (dto.reminderId) {
      const reminder = await prisma.reminder.findUnique({ where: { id: dto.reminderId } });
      if (!reminder) throw new AppointmentReminderNotFoundError(dto.reminderId);
    }

    return prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.startAt !== undefined && { startAt: dto.startAt }),
        ...(dto.endAt !== undefined && { endAt: dto.endAt }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.paid !== undefined && { paid: dto.paid }),
        ...(dto.locationId !== undefined && { locationId: dto.locationId }),
        ...(dto.meetingUrl !== undefined && { meetingUrl: dto.meetingUrl }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.typeId !== undefined && { typeId: dto.typeId }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.status === AppointmentStatus.CONFIRMED && { confirmedAt: new Date() }),
        ...(dto.status === AppointmentStatus.CANCELLED && { cancelledAt: new Date() }),
        ...(dto.status === AppointmentStatus.COMPLETED && { completedAt: new Date() }),
        ...(dto.reminderId !== undefined && {
          reminder: dto.reminderId
            ? { connect: { id: dto.reminderId } }
            : { disconnect: true },
        }),
      },
      include: appointmentInclude,
    });
  },

  async delete(id: string, userId: string): Promise<Appointment> {
    await appointmentRepository.findById(id, userId);
    return prisma.appointment.delete({ where: { id } });
  },

  async markPaid(id: string, userId: string): Promise<AppointmentWithRelations> {
    await appointmentRepository.findById(id, userId);
    return prisma.appointment.update({
      where: { id },
      data: { paid: true },
      include: appointmentInclude,
    });
  },

  async getStats(query: AppointmentStatsQuery, userId: string, timezone = 'UTC'): Promise<AppointmentStats> {
    const { patientId, dateFrom, dateTo } = query;
    const where: Prisma.AppointmentWhereInput = {
      patient: { userId },
      ...(patientId && { patientId }),
      ...(dateFrom || dateTo
        ? {
          startAt: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          },
        }
        : {}),
    };

    const { start: todayStart, end: todayEnd } = getTodayBoundsInTz(timezone);

    const [ statusGroups, paidAgg, unpaidAgg, todayAgg ] = await prisma.$transaction([
      prisma.appointment.groupBy({
        by: [ 'status' ],
        _count: { id: true },
        orderBy: { status: 'asc' },
        where,
      }),
      prisma.appointment.aggregate({
        _sum: { price: true },
        _count: { _all: true },
        where: { ...where, paid: true },
      }),
      prisma.appointment.aggregate({
        _sum: { price: true },
        _count: { _all: true },
        where: { ...where, paid: false },
      }),
      prisma.appointment.count({
        where: { ...where, startAt: { gte: todayStart, lte: todayEnd } },
      }),
    ]);

    const byStatus: Record<string, number> = Object.fromEntries(
      Object.values(AppointmentStatus).map(s => [ s, 0 ])
    );
    for (const group of statusGroups) {
      byStatus[ group.status ] = (group._count as { id: number }).id;
    }

    const paidRevenue = paidAgg._sum.price ?? 0;
    const unpaidRevenue = unpaidAgg._sum.price ?? 0;

    return {
      total: paidAgg._count._all + unpaidAgg._count._all,
      todayCount: todayAgg,
      byStatus,
      totalRevenue: paidRevenue + unpaidRevenue,
      paidRevenue,
      unpaidRevenue,
      unpaidCount: unpaidAgg._count._all,
    };
  },
};

