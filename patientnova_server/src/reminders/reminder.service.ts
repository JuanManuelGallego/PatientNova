import { ReminderMode } from '@prisma/client';
import { reminderRepository } from './reminder.repository.js';
import { ReminderNotCancellableError, ReminderSendAtInPastError } from '../utils/errors.js';

export const reminderService = {
  findById: reminderRepository.findById.bind(reminderRepository),
  findMany: reminderRepository.findMany.bind(reminderRepository),
  update: reminderRepository.update.bind(reminderRepository),
  delete: reminderRepository.delete.bind(reminderRepository),
  getStats: reminderRepository.getStats.bind(reminderRepository),

  async create(dto: Parameters<typeof reminderRepository.create>[0], userId: string) {
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
