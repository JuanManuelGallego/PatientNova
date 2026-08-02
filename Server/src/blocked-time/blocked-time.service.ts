import { blockedTimeRepository } from './blocked-time.repository.js';
import { BlockedTimeOverlapError } from './blocked-time.errors.js';
import { logger } from '../utils/api/logger.js';
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

  async create(dto: CreateBlockedTimeDto, userId: string) {
    await checkOverlap(userId, dto.startTimeUtc, dto.endTimeUtc);
    const createdBlockedTime = await blockedTimeRepository.create(dto, userId);
    await logAudit({
      entityType: EntityType.BLOCKED_TIME,
      entityId: createdBlockedTime.id,
      actionType: ActionType.CREATE,
      description: 'Bloqueo de tiempo creado',
      affectedFields: Object.keys(dto),
      fieldsAfter: dto as unknown as Record<string, unknown>,
    });
    return createdBlockedTime;
  },

  async update(id: string, dto: UpdateBlockedTimeDto, userId: string): Promise<BlockedTime> {
    const existingBlockedTime = await blockedTimeRepository.findById(id, userId);
    if (dto.startTimeUtc || dto.endTimeUtc) {
      const startAt = dto.startTimeUtc ?? existingBlockedTime.startTimeUtc.toISOString();
      const endAt = dto.endTimeUtc ?? existingBlockedTime.endTimeUtc.toISOString();
      await checkOverlap(userId, startAt, endAt, id);
    }
    const updatedBlockedTime = await blockedTimeRepository.update(id, dto, userId);
    const diff = computeDiff(existingBlockedTime as unknown as Record<string, unknown>, updatedBlockedTime as unknown as Record<string, unknown>, BLOCKED_TIME_DIFF_FIELDS);
    await logAudit({
      entityType: EntityType.BLOCKED_TIME,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: 'Bloqueo de tiempo actualizado',
      ...diff,
    });
    logger.info({ blockedTimeId: id, userId, fields: Object.keys(dto) }, 'Blocked time updated');
    return updatedBlockedTime;
  },

  async delete(id: string, userId: string): Promise<{ id: string }> {
    await blockedTimeRepository.delete(id, userId);
    await logAudit({
      entityType: EntityType.BLOCKED_TIME,
      entityId: id,
      actionType: ActionType.DELETE,
      description: 'Bloqueo de tiempo eliminado',
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: false },
      fieldsAfter: { isDeleted: true },
    });
    return { id };
  },

  async restore(id: string, userId: string) {
    const restoredBlockedTime = await blockedTimeRepository.restore(id, userId);
    await logAudit({
      entityType: EntityType.BLOCKED_TIME,
      entityId: id,
      actionType: ActionType.RESTORE,
      description: 'Bloqueo de tiempo restaurado',
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: true },
      fieldsAfter: { isDeleted: false },
    });
    return restoredBlockedTime;
  },
};
