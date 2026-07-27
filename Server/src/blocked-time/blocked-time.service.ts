import { blockedTimeRepository } from './blocked-time.repository.js';
import { BlockedTimeOverlapError } from './blocked-time.errors.js';
import { logger } from '../utils/api/logger.js';
import type { CreateBlockedTimeDto, UpdateBlockedTimeDto, ListBlockedTimeQuery } from './blocked-time.schemas.js';
import type { BlockedTime } from '../../generated/prisma/client.ts';
import type { Paginated } from '../utils/api/pagination.js';

async function checkOverlap(userId: string, startAt: string, endAt: string, excludeId?: string): Promise<void> {
  const overlap = await blockedTimeRepository.hasBlockedTimeOverlap(userId, new Date(startAt), new Date(endAt), excludeId);
  if (overlap) {
    throw new BlockedTimeOverlapError(overlap.startTimeUtc, overlap.endTimeUtc);
  }
}

export const blockedTimeService = {
  findById: blockedTimeRepository.findById.bind(blockedTimeRepository),

  async findMany(userId: string, query: ListBlockedTimeQuery): Promise<Paginated<BlockedTime>> {
    return blockedTimeRepository.findMany(userId, query);
  },

  async create(dto: CreateBlockedTimeDto, userId: string): Promise<BlockedTime> {
    await checkOverlap(userId, dto.startTimeUtc, dto.endTimeUtc);
    const blockedTime = await blockedTimeRepository.create(dto, userId);
    logger.info({ blockedTimeId: blockedTime.id, userId }, 'Blocked time created');
    return blockedTime;
  },

  async update(id: string, dto: UpdateBlockedTimeDto, userId: string): Promise<BlockedTime> {
    if (dto.startTimeUtc || dto.endTimeUtc) {
      const existing = await blockedTimeRepository.findById(id, userId);
      const startAt = dto.startTimeUtc ?? existing.startTimeUtc.toISOString();
      const endAt = dto.endTimeUtc ?? existing.endTimeUtc.toISOString();
      await checkOverlap(userId, startAt, endAt, id);
    }
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
