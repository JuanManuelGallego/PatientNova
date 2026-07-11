import { AppointmentStatus, Prisma, type Appointment } from '../../generated/prisma/client.ts';
import { prisma } from '../prisma/prismaClient.js';
import {
  type CreateAppointmentDto,
  type UpdateAppointmentDto,
  type ListAppointmentsQuery,
  type AppointmentStatsQuery,
} from './appointment.schemas.js';
import { AppointmentNotFoundError } from '../utils/errors.js';
import { paginate, type Paginated } from '../utils/pagination.js';
import { config } from '../utils/config.js';
import { appointmentInclude, type AppointmentWithRelations, type AppointmentStats } from '../utils/types.js';
import { getCurrentMonthBoundsInTz, getLocalTimeParts, getTodayBoundsInTz, localToUtc } from '../utils/timeUtils.js';
import { buildUpdateData } from '../utils/buildUpdateData.js';
import { softDelete, restore } from '../utils/softDelete.js';

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const appointmentRepository = {
  async create(dto: CreateAppointmentDto, userId: string, tx?: TransactionClient): Promise<AppointmentWithRelations> {
    const client = tx ?? prisma;
    return client.appointment.create({
      data: {
        startAt: dto.startAt,
        endAt: dto.endAt,
        timezone: dto.timezone || config.defaults.timezone,
        price: dto.price,
        currency: dto.currency || config.defaults.currency,
        paid: dto.paid,
        locationId: dto.locationId,
        meetingUrl: dto.meetingUrl || null,
        notes: dto.notes || null,
        typeId: dto.typeId,
        status: dto.status,
        patientId: dto.patientId,
        userId,
        ...(dto.reminderId && { reminder: { connect: { id: dto.reminderId } }, reminderId: dto.reminderId }),
      },
      include: appointmentInclude,
    });
  },

  async findById(id: string, userId: string, includeDeleted = false): Promise<Appointment> {
    const appt = await prisma.appointment.findFirst({
      where: { id, userId, ...(includeDeleted ? {} : { isDeleted: false }) },
    });
    if (!appt) throw new AppointmentNotFoundError(id);
    return appt;
  },

  async findByIdWithRelations(id: string, userId: string): Promise<AppointmentWithRelations> {
    const appt = await prisma.appointment.findFirst({
      where: { id, userId, isDeleted: false },
      include: appointmentInclude,
    });
    if (!appt) throw new AppointmentNotFoundError(id);
    return appt;
  },

  async findMany(query: ListAppointmentsQuery, userId: string, timezone = 'UTC'): Promise<Paginated<AppointmentWithRelations>> {
    const { patientId, status, startAt, dateFrom, dateTo, paid, search, page, pageSize, orderBy, order, locationId, typeId, includeDeleted } = query;
    const skip = (page - 1) * pageSize;

    const startAtFilter: Prisma.DateTimeFilter | undefined = (() => {
      if (startAt) {
        const parts = getLocalTimeParts(timezone, new Date(startAt));
        const dayStart = localToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timezone);
        const dayEnd = localToUtc(parts.year, parts.month, parts.day, 23, 59, 59, timezone);
        return { gte: dayStart, lte: dayEnd };
      }
      if (dateFrom || dateTo) {
        return {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        };
      }
      return undefined;
    })();

    const where: Prisma.AppointmentWhereInput = {
      userId,
      ...(includeDeleted ? {} : { isDeleted: false }),
      ...(patientId && { patientId }),
      ...(locationId && { locationId }),
      ...(typeId && { typeId }),
      ...(status && {
        status: Array.isArray(status) ? { in: status } : status
      }),
      ...(paid !== undefined && { paid }),
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
      ...(startAtFilter && { startAt: startAtFilter }),
    };

    return paginate(
      prisma.appointment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [ orderBy ]: order },
        include: appointmentInclude,
      }),
      prisma.appointment.count({ where }),
      page,
      pageSize,
    );
  },

  async update(id: string, dto: UpdateAppointmentDto, tx?: TransactionClient): Promise<AppointmentWithRelations> {
    const client = tx ?? prisma;
    const data: Prisma.AppointmentUpdateInput = buildUpdateData(
      dto,
      [ 'startAt', 'endAt', 'timezone', 'price', 'currency', 'paid', 'locationId', 'meetingUrl', 'notes', 'typeId', 'status' ],
    );

    if (dto.status === AppointmentStatus.SCHEDULED) {
      data.confirmedAt = null;
      data.cancelledAt = null;
      data.completedAt = null;
    } else if (dto.status === AppointmentStatus.CONFIRMED) {
      data.confirmedAt = new Date();
    } else if (dto.status === AppointmentStatus.CANCELLED) {
      data.cancelledAt = new Date();
    } else if (dto.status === AppointmentStatus.COMPLETED) {
      data.completedAt = new Date();
    }

    if (dto.reminderId !== undefined) {
      data.reminder = dto.reminderId
        ? { connect: { id: dto.reminderId } }
        : { disconnect: true };
    }

    return client.appointment.update({
      where: { id },
      data,
      include: appointmentInclude,
    });
  },

  async delete(id: string, userId: string): Promise<Appointment> {
    await appointmentRepository.findById(id, userId);
    return softDelete(prisma.appointment, id);
  },

  async restore(id: string, userId: string): Promise<AppointmentWithRelations> {
    await appointmentRepository.findById(id, userId, true);
    return restore(prisma.appointment, id, appointmentInclude);
  },

  async getStats(query: AppointmentStatsQuery, userId: string, timezone = 'UTC'): Promise<AppointmentStats> {
    const { patientId, dateFrom, dateTo, includeDeleted } = query;
    const where: Prisma.AppointmentWhereInput = {
      userId,
      ...(includeDeleted ? {} : { isDeleted: false }),
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
    const { start: monthStart, end: monthEnd } = getCurrentMonthBoundsInTz(timezone);

    const [ statusGroups, paidAgg, unpaidAgg, todayAgg, paidAggThisMonth ] = await prisma.$transaction([
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
        where: { ...where, paid: false, status: { not: AppointmentStatus.CANCELLED } },
      }),
      prisma.appointment.count({
        where: { ...where, startAt: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.appointment.aggregate({
        _sum: { price: true },
        where: {
          ...where,
          paid: true,
          startAt: { gte: monthStart, lte: monthEnd },
        },
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
    const paidRevenueThisMonth = paidAggThisMonth._sum.price ?? 0;

    return {
      total: paidAgg._count._all + unpaidAgg._count._all,
      todayCount: todayAgg,
      byStatus,
      totalRevenue: paidRevenue + unpaidRevenue,
      paidRevenue,
      paidRevenueThisMonth,
      unpaidRevenue,
      unpaidCount: unpaidAgg._count._all,
    };
  },
};
