import { auditLogRepository } from './audit-log.repository.js';
import { logger } from '../utils/api/logger.js';
import type { CreateAuditLogDto, ListAuditLogsQuery } from './audit-log.schemas.js';
import type { Paginated } from '../utils/api/pagination.js';
import type { AuditLog } from '../../generated/prisma/client.ts';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';

export const auditLogService = {
  findById(id: string, userId: string): Promise<AuditLog> {
    return auditLogRepository.findById(id, userId);
  },

  findMany(userId: string, query: ListAuditLogsQuery): Promise<Paginated<AuditLog>> {
    return auditLogRepository.findMany(userId, query);
  },

  /** Writes the audit row and rethrows on failure. Use inside transactions where the audit is part of the change. */
  async createOrThrow(dto: CreateAuditLogDto, tx?: TransactionClient) {
    const log = await auditLogRepository.create(dto, tx);
    logger.info({ auditLogId: log.id, entityType: log.entityType, entityId: log.entityId, actionType: log.actionType }, 'Audit log created');
    return log;
  },

  /** Best-effort: logs and swallows failures. Only for non-transactional legacy paths. */
  async create(dto: CreateAuditLogDto, tx?: TransactionClient) {
    try {
      return await auditLogService.createOrThrow(dto, tx);
    } catch (err) {
      logger.error({ err, entityType: dto.entityType, entityId: dto.entityId, actionType: dto.actionType }, 'Failed to create audit log');
    }
  },
};
