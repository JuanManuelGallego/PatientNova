import { ReminderMode } from '../../generated/prisma/client.ts';
import { reminderRepository } from './reminder.repository.js';
import { ReminderNotCancellableError, ReminderSendAtInPastError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { CreateReminderDto, UpdateReminderDto, ListRemindersQuery, ReminderStatsQuery } from './reminder.schemas.ts';
import type { Paginated } from '../utils/pagination.ts';
import type { ReminderWithRelations, ReminderStats } from '../utils/types.ts';
import type { Reminder } from '../../generated/prisma/client.ts';

export const reminderService = {
  findById: reminderRepository.findById.bind(reminderRepository),

  async findMany(query: ListRemindersQuery, userId: string): Promise<Paginated<ReminderWithRelations>> {
    return reminderRepository.findMany(query, userId);
  },

  async getStats(query: ReminderStatsQuery, userId: string): Promise<ReminderStats> {
    return reminderRepository.getStats(query, userId);
  },

  async create(dto: CreateReminderDto, userId: string): Promise<Reminder> {
    if (dto.sendMode === ReminderMode.SCHEDULED) {
      if (!dto.sendAt || new Date(dto.sendAt) <= new Date()) {
        throw new ReminderSendAtInPastError();
      }
    }
    const reminder = await reminderRepository.create(dto, userId);
    logger.info({ reminderId: reminder.id, userId, mode: dto.sendMode }, 'Reminder created');
    return reminder;
  },

  async update(id: string, dto: UpdateReminderDto, userId: string): Promise<Reminder> {
    const reminder = await reminderRepository.update(id, dto, userId);
    logger.info({ reminderId: id, userId, fields: Object.keys(dto) }, 'Reminder updated');
    return reminder;
  },

  async cancel(id: string, userId: string): Promise<Reminder> {
    const reminder = await reminderRepository.findById(id, userId);
    if (reminder.status !== 'PENDING') {
      throw new ReminderNotCancellableError(reminder.status);
    }
    const cancelled = await reminderRepository.cancel(id, userId);
    logger.info({ reminderId: id, userId }, 'Reminder cancelled');
    return cancelled;
  },

  async softDelete(id: string, userId: string): Promise<Reminder> {
    const reminder = await reminderRepository.delete(id, userId);
    logger.info({ reminderId: id, userId }, 'Reminder deleted');
    return reminder;
  },

  async restore(id: string, userId: string): Promise<Reminder> {
    const reminder = await reminderRepository.restore(id, userId);
    logger.info({ reminderId: id, userId }, 'Reminder restored');
    return reminder;
  },
};
