import { Prisma, ReminderStatus, type Reminder, type Channel } from '../../generated/prisma/client.ts';
import { prisma } from '../prisma/prismaClient.js';
import type { CreateReminderDto, UpdateReminderDto, ListRemindersQuery, ReminderStatsQuery } from './reminder.schemas.js';
import { PatientNotFoundError, ReminderNotFoundError } from '../utils/errors.js';
import { paginate, type Paginated } from '../utils/pagination.js';
import { reminderInclude, type ReminderWithRelations, type ReminderStats } from '../utils/types.js';
import { buildUpdateData } from '../utils/buildUpdateData.js';
import { softDelete, restore } from '../utils/softDelete.js';

export const reminderRepository = {
  async create(dto: CreateReminderDto, userId: string): Promise<Reminder> {
    const patient = await prisma.patient.findFirst({ where: { id: dto.patientId, userId } });
    if (!patient) throw new PatientNotFoundError(dto.patientId);
    return prisma.reminder.create({
      data: {
        channel: dto.channel,
        contentSid: dto.contentSid || null,
        ...(dto.contentVariables && { contentVariables: dto.contentVariables }),
        messageId: dto.messageId || null,
        sendMode: dto.sendMode,
        patientId: dto.patientId,
        userId,
        appointmentId: dto.appointmentId || null,
        sendAt: new Date(dto.sendAt),
        status: dto.status,
        to: dto.to,
        body: dto.body || null,
      },
      include: reminderInclude,
    });
  },

  async findById(id: string, userId: string): Promise<Reminder> {
    const reminder = await prisma.reminder.findFirst({
      where: { id, userId },
      include: reminderInclude,
    });
    if (!reminder) throw new ReminderNotFoundError(id);
    return reminder;
  },

  async findMany(query: ListRemindersQuery, userId: string): Promise<Paginated<ReminderWithRelations>> {
    const { status, search, patientId, dateTo, dateFrom, page, pageSize, orderBy, order, includeDeleted } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ReminderWhereInput = {
      userId,
      ...(includeDeleted ? {} : { isDeleted: false }),
      ...(status && {
        status: Array.isArray(status) ? { in: status } : status
      }),
      ...(search && {
        OR: [
          ...((Object.values({ WHATSAPP: 'WHATSAPP', SMS: 'SMS', EMAIL: 'EMAIL' }) as Channel[])
            .filter(c => c.toLowerCase().includes(search.toLowerCase()))
            .map(c => ({ channel: c }))),
          { to: { contains: search, mode: 'insensitive' } },
          {
            patient: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } }
              ]
            }
          } ]
      }),
      ...(patientId && { patientId: patientId }),
      ...(dateFrom || dateTo
        ? {
          sendAt: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        } : {})
    };

    return paginate(
      prisma.reminder.findMany({ where, skip, take: pageSize, orderBy: { [ orderBy ]: order }, include: reminderInclude }),
      prisma.reminder.count({ where }),
      page,
      pageSize,
    );
  },

  async update(id: string, dto: UpdateReminderDto, userId: string): Promise<Reminder> {
    await reminderRepository.findById(id, userId);

    const data = buildUpdateData(
      dto,
      [ 'channel', 'contentSid', 'contentVariables', 'error', 'messageId', 'sendMode', 'sendAt', 'status', 'body' ],
    );

    // Handle status-based timestamp field
    if (dto.status === ReminderStatus.SENT) {
      (data as any).sentAt = new Date();
    }

    return prisma.reminder.update({
      where: { id },
      data,
      include: reminderInclude,
    });
  },

  async cancel(id: string, userId: string): Promise<Reminder> {
    await reminderRepository.findById(id, userId);
    return prisma.reminder.update({ where: { id }, data: { status: 'CANCELLED' }, include: reminderInclude });
  },

  async delete(id: string, userId: string): Promise<Reminder> {
    await reminderRepository.findById(id, userId);
    return softDelete(prisma.reminder, id, reminderInclude);
  },

  async restore(id: string, userId: string): Promise<Reminder> {
    await reminderRepository.findById(id, userId);
    return restore(prisma.reminder, id, reminderInclude);
  },

  async getStats(query: ReminderStatsQuery, userId: string): Promise<ReminderStats> {
    const { patientId, dateFrom, dateTo } = query;
    const where: Prisma.ReminderWhereInput = {
      userId,
      ...(patientId && { patientId }),
      ...(dateFrom || dateTo
        ? {
          sendAt: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          },
        }
        : {}),
    };

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const [ statusGroups, channelGroups, todayCount ] = await prisma.$transaction([
      prisma.reminder.groupBy({
        by: [ 'status' ],
        _count: { id: true },
        orderBy: { status: 'asc' },
        where,
      }),
      prisma.reminder.groupBy({
        by: [ 'channel' ],
        _count: { id: true },
        orderBy: { channel: 'asc' },
        where,
      }),
      prisma.reminder.count({
        where: { ...where, sendAt: { gte: todayStart, lte: todayEnd } },
      }),
    ]);

    const byStatus: Record<string, number> = Object.fromEntries(
      Object.values(ReminderStatus).map(s => [ s, 0 ])
    );
    for (const group of statusGroups) {
      byStatus[ group.status ] = (group._count as { id: number }).id;
    }

    const byChannel: Record<string, number> = { WHATSAPP: 0, SMS: 0, EMAIL: 0 };
    for (const group of channelGroups) {
      byChannel[ group.channel ] = (group._count as { id: number }).id;
    }

    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

    return { total, todayCount, byStatus, byChannel };
  },
};
