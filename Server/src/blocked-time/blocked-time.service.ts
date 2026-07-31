import { blockedTimeRepository } from './blocked-time.repository.js';
import { BlockedTimeOverlapError } from './blocked-time.errors.js';
import { logger } from '../utils/api/logger.js';
import { withAudit } from '../audit-log/with-audit.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreateBlockedTimeDto, UpdateBlockedTimeDto, ListBlockedTimeQuery } from './blocked-time.schemas.js';
import { updateBlockedTimeSchema } from './blocked-time.schemas.js';
import type { BlockedTime } from '../../generated/prisma/client.ts';
import type { Paginated } from '../utils/api/pagination.ts';
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

  create: withAudit(
    async (dto: CreateBlockedTimeDto, userId: string) => {
      await checkOverlap(userId, dto.startTimeUtc, dto.endTimeUtc);
      return blockedTimeRepository.create(dto, userId);
    },
    {
      entityType: EntityType.BLOCKED_TIME,
      action: 'CREATE',
      description: 'Created blocked time slot',
      affectedFields: (_bt, dto) => Object.keys(dto),
      fieldsAfter: (_bt, dto) => dto as unknown as Record<string, unknown>,
    },
  ),

  async update(id: string, dto: UpdateBlockedTimeDto, userId: string): Promise<BlockedTime> {
    const before = await blockedTimeRepository.findById(id, userId);
    if (dto.startTimeUtc || dto.endTimeUtc) {
      const startAt = dto.startTimeUtc ?? before.startTimeUtc.toISOString();
      const endAt = dto.endTimeUtc ?? before.endTimeUtc.toISOString();
      await checkOverlap(userId, startAt, endAt, id);
    }
    const blockedTime = await blockedTimeRepository.update(id, dto, userId);
    const diff = computeDiff(before as unknown as Record<string, unknown>, blockedTime as unknown as Record<string, unknown>, BLOCKED_TIME_DIFF_FIELDS);
    await logAudit({
      entityType: EntityType.BLOCKED_TIME,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: 'Updated blocked time slot',
      ...diff,
    });
    logger.info({ blockedTimeId: id, userId, fields: Object.keys(dto) }, 'Blocked time updated');
    return blockedTime;
  },

  delete: withAudit(
    (id: string, userId: string) => blockedTimeRepository.delete(id, userId),
    {
      entityType: EntityType.BLOCKED_TIME,
      action: 'DELETE',
      description: 'Deleted blocked time slot',
      getBefore: (id, userId) =>
        blockedTimeRepository.findById(id, userId) as Promise<Record<string, unknown>>,
      fieldsBefore: (before) => ({
        description: before.description,
        startTimeUtc: before.startTimeUtc,
        endTimeUtc: before.endTimeUtc,
      }),
    },
  ),

  restore: withAudit(
    (id: string, userId: string) => blockedTimeRepository.restore(id, userId),
    {
      entityType: EntityType.BLOCKED_TIME,
      action: 'RESTORE',
      description: 'Restored blocked time slot',
      fieldsAfter: (bt) => ({
        description: bt.description,
        startTimeUtc: bt.startTimeUtc,
        endTimeUtc: bt.endTimeUtc,
      }),
    },
  ),
};
