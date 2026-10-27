import { blockedTimeRepository } from './blocked-time.repository.js';
import { BlockedTimeInvalidRangeError, BlockedTimeOverlapError } from './blocked-time.errors.js';
import { logger } from '../utils/api/logger.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreateBlockedTimeDto, UpdateBlockedTimeDto, ListBlockedTimeQuery } from './blocked-time.schemas.js';
import { updateBlockedTimeSchema } from './blocked-time.schemas.js';
import type { BlockedTime } from '../../generated/prisma/client.ts';
import type { Paginated } from '../utils/api/pagination.ts';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const BLOCKED_TIME_DIFF_FIELDS = schemaKeys(updateBlockedTimeSchema);

async function checkOverlap(tx: TransactionClient, userId: string, startAt: string, endAt: string, excludeId?: string): Promise<void> {
  const overlap = await blockedTimeRepository.hasBlockedTimeOverlap(userId, new Date(startAt), new Date(endAt), excludeId, tx);
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
    return prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      await checkOverlap(tx, userId, dto.startTimeUtc, dto.endTimeUtc);
      const createdBlockedTime = await blockedTimeRepository.create(dto, userId, tx);
      await logAudit({
        entityType: EntityType.BLOCKED_TIME,
        entityId: createdBlockedTime.id,
        userId,
        actionType: ActionType.CREATE,
        description: 'Bloqueo de tiempo creado',
        affectedFields: Object.keys(dto),
        fieldsAfter: dto as unknown as Record<string, unknown>,
        tx,
        required: true,
      });
      return createdBlockedTime;
    });
  },

  async update(id: string, dto: UpdateBlockedTimeDto, userId: string): Promise<BlockedTime> {
    const updatedBlockedTime = await prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const existing = await blockedTimeRepository.findById(id, userId, false, tx);
      if (dto.startTimeUtc || dto.endTimeUtc) {
        const startAt = dto.startTimeUtc ?? existing.startTimeUtc.toISOString();
        const endAt = dto.endTimeUtc ?? existing.endTimeUtc.toISOString();
        if (new Date(endAt).getTime() <= new Date(startAt).getTime()) throw new BlockedTimeInvalidRangeError();
        await checkOverlap(tx, userId, startAt, endAt, id);
      }
      const updated = await blockedTimeRepository.update(id, dto, userId, tx);
      const diff = computeDiff(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, BLOCKED_TIME_DIFF_FIELDS);
      await logAudit({
        entityType: EntityType.BLOCKED_TIME,
        entityId: id,
        userId,
        actionType: ActionType.UPDATE,
        description: 'Bloqueo de tiempo actualizado',
        ...diff,
        tx,
        required: true,
      });
      return updated;
    });
    logger.info({ blockedTimeId: id, userId, fields: Object.keys(dto) }, 'Blocked time updated');
    return updatedBlockedTime;
  },

  async delete(id: string, userId: string): Promise<{ id: string }> {
    await blockedTimeRepository.delete(id, userId);
    await logAudit({
      entityType: EntityType.BLOCKED_TIME,
      entityId: id,
      userId,
      actionType: ActionType.DELETE,
      description: 'Bloqueo de tiempo eliminado',
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: false },
      fieldsAfter: { isDeleted: true },
    });
    return { id };
  },

  async restore(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const existing = await blockedTimeRepository.findById(id, userId, true, tx);
      await checkOverlap(tx, userId, existing.startTimeUtc.toISOString(), existing.endTimeUtc.toISOString(), id);
      const restoredBlockedTime = await blockedTimeRepository.restore(id, userId, tx);
      await logAudit({
        entityType: EntityType.BLOCKED_TIME,
        entityId: id,
        userId,
        actionType: ActionType.RESTORE,
        description: 'Bloqueo de tiempo restaurado',
        affectedFields: ['isDeleted'],
        fieldsBefore: { isDeleted: true },
        fieldsAfter: { isDeleted: false },
        tx,
        required: true,
      });
      return restoredBlockedTime;
    });
  },
};
