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
import { getCurrentMonthBoundsInTz, getTodayBoundsInTz } from '../utils/timeUtils.js';

export const appointmentRepository = {
  async create(dto: CreateAppointmentDto, userId: string): Promise<AppointmentWithRelations> {
    return prisma.appointment.create({
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

  async findById(id: string, userId: string): Promise<Appointment> {
    const appt = await prisma.appointment.findFirst({
      where: { id, userId },
    });
    if (!appt) throw new AppointmentNotFoundError(id);
    return appt;
  },

  async findByIdWithRelations(id: string, userId: string): Promise<AppointmentWithRelations> {
    const appt = await prisma.appointment.findFirst({
      where: { id, userId },
      include: appointmentInclude,
    });
    if (!appt) throw new AppointmentNotFoundError(id);
    return appt;
  },

  async findMany(query: ListAppointmentsQuery, userId: string, timezone = 'UTC'): Promise<Paginated<AppointmentWithRelations>> {
    const { patientId, status, startAt, dateFrom, dateTo, paid, search, page, pageSize, orderBy, order, locationId, typeId, includeDeleted } = query;
    const skip = (page - 1) * pageSize;
    const { start: todayStart, end: todayEnd } = getTodayBoundsInTz(timezone);


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

  async update(id: string, dto: UpdateAppointmentDto): Promise<AppointmentWithRelations> {

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
    return prisma.appointment.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  },

  async restore(id: string, userId: string): Promise<Appointment> {
    await appointmentRepository.findById(id, userId);
    return prisma.appointment.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null },
    });
  },

  async markPaid(id: string, userId: string): Promise<AppointmentWithRelations> {
    await appointmentRepository.findById(id, userId);
    return prisma.appointment.update({
      where: { id },
      data: { paid: true },
      include: appointmentInclude,
    });
  },

  async markConfirmed(id: string, userId: string): Promise<AppointmentWithRelations> {
    await appointmentRepository.findById(id, userId);
    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CONFIRMED, confirmedAt: new Date() },
      include: appointmentInclude,
    });
  },

  async markCancelled(id: string, userId: string): Promise<AppointmentWithRelations> {
    await appointmentRepository.findById(id, userId);
    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED, cancelledAt: new Date() },
      include: appointmentInclude,
    });
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
        where: { ...where, paid: false },
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

