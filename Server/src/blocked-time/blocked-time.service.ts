import { blockedTimeRepository } from './blocked-time.repository.js';
import { logger } from '../utils/api/logger.js';
import type { CreateBlockedTimeDto, UpdateBlockedTimeDto, ListBlockedTimeQuery } from './blocked-time.schemas.js';
import type { BlockedTime } from '../../generated/prisma/client.ts';
import type { Paginated } from '../utils/api/pagination.js';

export const blockedTimeService = {
  findById: blockedTimeRepository.findById.bind(blockedTimeRepository),

  async findMany(userId: string, query: ListBlockedTimeQuery): Promise<Paginated<BlockedTime>> {
    return blockedTimeRepository.findMany(userId, query);
  },

  async create(dto: CreateBlockedTimeDto, userId: string): Promise<BlockedTime> {
    const blockedTime = await blockedTimeRepository.create(dto, userId);
    logger.info({ blockedTimeId: blockedTime.id, userId }, 'Blocked time created');
    return blockedTime;
  },

  async update(id: string, dto: UpdateBlockedTimeDto, userId: string): Promise<BlockedTime> {
    const blockedTime = await blockedTimeRepository.update(id, dto, userId);
    logger.info({ blockedTimeId: id, userId, fields: Object.keys(dto) }, 'Blocked time updated');
    return blockedTime;
  },

  async delete(id: string, userId: string): Promise<BlockedTime> {
    const blockedTime = await blockedTimeRepository.delete(id, userId);
    logger.info({ blockedTimeId: id, userId }, 'Blocked time deleted');
    return blockedTime;
  },

  async restore(id: string, userId: string): Promise<BlockedTime> {
    const blockedTime = await blockedTimeRepository.restore(id, userId);
    logger.info({ blockedTimeId: id, userId }, 'Blocked time restored');
    return blockedTime;
  },
};
