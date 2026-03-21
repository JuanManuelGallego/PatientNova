import { Prisma, ReminderStatus, type Reminder, type Channel } from '@prisma/client';
import { prisma } from '../prisma/prismaClient.js';
import type { CreateReminderDto, UpdateReminderDto, ListRemindersQuery, ReminderStatsQuery } from './reminder.schemas.js';
import { ReminderNotFoundError, ReminderNotCancellableError } from '../utils/errors.js';
import { reminderInclude, type PaginatedReminders, type ReminderStats } from '../utils/types.js';

export const reminderRepository = {
  async create(dto: CreateReminderDto): Promise<Reminder> {
    return prisma.reminder.create({
      data: {
        channel: dto.channel,
        contentSid: dto.contentSid || null,
        ...(dto.contentVariables && { contentVariables: dto.contentVariables }),
        messageId: dto.messageId || null,
        sendMode: dto.sendMode,
        patientId: dto.patientId,
        appointmentId: dto.appointmentId || null,
        sendAt: new Date(dto.sendAt),
        status: dto.status,
        to: dto.to,
      },
      include: reminderInclude,
    });
  },

  async findById(id: string): Promise<Reminder> {
    const reminder = await prisma.reminder.findUnique({
      where: { id },
      include: reminderInclude,
    });
    if (!reminder) throw new ReminderNotFoundError(id);
    return reminder;
  },

  async findMany(query: ListRemindersQuery): Promise<PaginatedReminders> {
    const { status, search, patientId, dateTo, dateFrom, page, pageSize, orderBy, order } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ReminderWhereInput = {
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

    const [ data, total ] = await prisma.$transaction([
      prisma.reminder.findMany({ where, skip, take: pageSize, orderBy: { [ orderBy ]: order }, include: reminderInclude }),
      prisma.reminder.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async update(id: string, dto: UpdateReminderDto): Promise<Reminder> {
    await reminderRepository.findById(id); // throws if not found
    return prisma.reminder.update({
      where: { id },
      data: {
        ...(dto.channel !== undefined && { channel: dto.channel }),
        ...(dto.contentSid !== undefined && { contentSid: dto.contentSid }),
        ...(dto.contentVariables !== undefined && { contentVariables: dto.contentVariables }),
        ...(dto.error !== undefined && { error: dto.error }),
        ...(dto.messageId !== undefined && { messageId: dto.messageId }),
        ...(dto.sendMode !== undefined && { sendMode: dto.sendMode }),
        ...(dto.sendAt !== undefined && { sendAt: dto.sendAt }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.status === ReminderStatus.SENT && { sentAt: new Date() })
      },
      include: reminderInclude,
    });
  },

  async cancel(id: string): Promise<Reminder> {
    const reminder = await reminderRepository.findById(id);
    if (reminder.status !== 'PENDING') {
      throw new ReminderNotCancellableError(reminder.status);
    }
    return prisma.reminder.update({ where: { id }, data: { status: 'CANCELLED' }, include: reminderInclude });
  },

  async delete(id: string): Promise<Reminder> {
    await reminderRepository.findById(id);
    return prisma.reminder.delete({ where: { id }, include: reminderInclude });
  },

  async getStats(query: ReminderStatsQuery): Promise<ReminderStats> {
    const { patientId, dateFrom, dateTo } = query;
    const where: Prisma.ReminderWhereInput = {
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
