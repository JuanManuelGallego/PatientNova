import { ReminderMode } from '../../generated/prisma/client.ts';
import { reminderRepository } from './reminder.repository.js';
import { ReminderNotCancellableError, ReminderSendAtInPastError } from '../utils/errors.js';
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
    if (dto.sendMode === ReminderMode.SCHEDULED && dto.sendAt && new Date(dto.sendAt) <= new Date()) {
      throw new ReminderSendAtInPastError();
    }
    return reminderRepository.create(dto, userId);
  },

  async update(id: string, dto: UpdateReminderDto, userId: string): Promise<Reminder> {
    return reminderRepository.update(id, dto, userId);
  },

  async cancel(id: string, userId: string): Promise<Reminder> {
    const reminder = await reminderRepository.findById(id, userId);
    if (reminder.status !== 'PENDING') {
      throw new ReminderNotCancellableError(reminder.status);
    }
    return reminderRepository.cancel(id, userId);
  },

  async softDelete(id: string, userId: string): Promise<Reminder> {
    return reminderRepository.delete(id, userId);
  },

  async restore(id: string, userId: string): Promise<Reminder> {
    return reminderRepository.restore(id, userId);
  },
};
