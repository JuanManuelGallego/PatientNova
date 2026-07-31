import { blockedTimeRepository } from './blocked-time.repository.js';
import { BlockedTimeOverlapError } from './blocked-time.errors.js';
import { logger } from '../utils/api/logger.js';
import { auditLogService } from '../audit-log/audit-log.service.js';
import { buildAuditEntry, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreateBlockedTimeDto, UpdateBlockedTimeDto, ListBlockedTimeQuery } from './blocked-time.schemas.js';
import { updateBlockedTimeSchema } from './blocked-time.schemas.js';
import type { BlockedTime } from '../../generated/prisma/client.ts';
import type { Paginated } from '../utils/api/pagination.js';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const BLOCKED_TIME_DIFF_FIELDS = schemaKeys(updateBlockedTimeSchema);

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
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.BLOCKED_TIME,
      entityId: blockedTime.id,
      actionType: ActionType.CREATE,
      description: `Created blocked time slot`,
      affectedFields: Object.keys(dto),
      fieldsAfter: dto as unknown as Record<string, unknown>,
    }));
    logger.info({ blockedTimeId: blockedTime.id, userId }, 'Blocked time created');
    return blockedTime;
  },

  async update(id: string, dto: UpdateBlockedTimeDto, userId: string): Promise<BlockedTime> {
    const before = await blockedTimeRepository.findById(id, userId);
    if (dto.startTimeUtc || dto.endTimeUtc) {
      const startAt = dto.startTimeUtc ?? before.startTimeUtc.toISOString();
      const endAt = dto.endTimeUtc ?? before.endTimeUtc.toISOString();
      await checkOverlap(userId, startAt, endAt, id);
    }
    const blockedTime = await blockedTimeRepository.update(id, dto, userId);
    const diff = computeDiff(before as unknown as Record<string, unknown>, blockedTime as unknown as Record<string, unknown>, BLOCKED_TIME_DIFF_FIELDS);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.BLOCKED_TIME,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: `Updated blocked time slot`,
      ...diff,
    }));
    logger.info({ blockedTimeId: id, userId, fields: Object.keys(dto) }, 'Blocked time updated');
    return blockedTime;
  },

  async delete(id: string, userId: string): Promise<BlockedTime> {
    const before = await blockedTimeRepository.findById(id, userId);
    const blockedTime = await blockedTimeRepository.delete(id, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.BLOCKED_TIME,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Deleted blocked time slot`,
      fieldsBefore: { description: before.description, startTimeUtc: before.startTimeUtc, endTimeUtc: before.endTimeUtc },
    }));
    logger.info({ blockedTimeId: id, userId }, 'Blocked time deleted');
    return blockedTime;
  },

  async restore(id: string, userId: string): Promise<BlockedTime> {
    const blockedTime = await blockedTimeRepository.restore(id, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.BLOCKED_TIME,
      entityId: id,
      actionType: ActionType.RESTORE,
      description: `Restored blocked time slot`,
      fieldsAfter: { description: blockedTime.description, startTimeUtc: blockedTime.startTimeUtc, endTimeUtc: blockedTime.endTimeUtc },
    }));
    logger.info({ blockedTimeId: id, userId }, 'Blocked time restored');
    return blockedTime;
  },
};
