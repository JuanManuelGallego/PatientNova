import { ReminderMode } from '../../generated/prisma/client.ts';
import { reminderRepository } from './reminder.repository.js';
import { ReminderNotCancellableError, ReminderSendAtInPastError } from '../utils/errors.js';
import type { CreateReminderDto } from './reminder.schemas.ts';

export const reminderService = {
  findById: reminderRepository.findById.bind(reminderRepository),
  findMany: reminderRepository.findMany.bind(reminderRepository),
  update: reminderRepository.update.bind(reminderRepository),
  delete: reminderRepository.delete.bind(reminderRepository),
  restore: reminderRepository.restore.bind(reminderRepository),
  getStats: reminderRepository.getStats.bind(reminderRepository),

  async create(dto: CreateReminderDto, userId: string) {
    if (dto.sendMode === ReminderMode.SCHEDULED && dto.sendAt && new Date(dto.sendAt) <= new Date()) {
      throw new ReminderSendAtInPastError();
    }
    return reminderRepository.create(dto, userId);
  },

  async cancel(id: string, userId: string) {
    const reminder = await reminderRepository.findById(id, userId);
    if (reminder.status !== 'PENDING') {
      throw new ReminderNotCancellableError(reminder.status);
    }
    return reminderRepository.cancel(id, userId);
  },
};
