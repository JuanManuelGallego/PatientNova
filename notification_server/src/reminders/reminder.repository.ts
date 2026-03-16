import { Prisma, ReminderStatus, type Reminder, type Channel } from '@prisma/client';
import { prisma } from '../prisma/prismaClient.js';
import type { CreateReminderDto, UpdateReminderDto, ListRemindersQuery } from './reminder.schemas.js';
import { ReminderNotFoundError, ReminderNotCancellableError } from '../utils/errors.js';
import type { PaginatedReminders } from '../utils/types.js';

function toChannel(channel: string): Channel {
  return channel.toUpperCase() as Channel;
}

export const reminderRepository = {
  async create(dto: CreateReminderDto): Promise<Reminder> {
    return prisma.reminder.create({
      data: {
        channel: toChannel(dto.channel),
        to: dto.to,
        mode: dto.mode,
        contentSid: dto.contentSid ?? null,
        sendAt: new Date(dto.sendAt),
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: dto.status ?? ReminderStatus.PENDING,
        messageId: dto.messageId ?? null,
        patientId: dto.patientId ?? null,
      },
    });
  },

  async findById(id: string): Promise<Reminder> {
    const reminder = await prisma.reminder.findUnique({
      where: { id },
      include: { appointments: true },
    });
    if (!reminder) throw new ReminderNotFoundError(id);
    return reminder;
  },

  async findMany(query: ListRemindersQuery): Promise<PaginatedReminders> {
    const { status, channel, page, pageSize, orderBy, order } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ReminderWhereInput = {
      ...(status && { status }),
      ...(channel && { channel: toChannel(channel) }),
    };

    const [ data, total ] = await prisma.$transaction([
      prisma.reminder.findMany({ where, skip, take: pageSize, orderBy: { [ orderBy ]: order } }),
      prisma.reminder.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async update(id: string, dto: UpdateReminderDto): Promise<Reminder> {
    await reminderRepository.findById(id); // throws if not found
    return prisma.reminder.update({
      where: { id },
      data: {
        ...(dto.channel !== undefined && { channel: toChannel(dto.channel) }),
        ...(dto.to !== undefined && { to: dto.to }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.contentSid !== undefined && { contentSid: dto.contentSid }),
        ...(dto.mode !== undefined && { mode: dto.mode }),
        ...(dto.scheduledAt !== undefined && { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null }),
        ...(dto.sendAt !== undefined && { sendAt: new Date(dto.sendAt) }),
        ...(dto.error !== undefined && { error: dto.error }),
      },
    });
  },

  async cancel(id: string): Promise<Reminder> {
    const reminder = await reminderRepository.findById(id);
    if (reminder.status !== 'PENDING') {
      throw new ReminderNotCancellableError(reminder.status);
    }
    return prisma.reminder.update({ where: { id }, data: { status: 'CANCELLED' } });
  },

  async delete(id: string): Promise<Reminder> {
    await reminderRepository.findById(id);
    return prisma.reminder.delete({ where: { id } });
  },
};
