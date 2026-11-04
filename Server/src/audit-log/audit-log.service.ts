import { auditLogRepository } from './audit-log.repository.js';
import { logger } from '../utils/api/logger.js';
import { prisma } from '../utils/prisma/prisma-client.js';
import { buildPaginatedResult, type Paginated } from '../utils/api/pagination.js';
import { portalActorId } from './audit-actors.js';
import type { CreateAuditLogDto, ListAuditLogsQuery } from './audit-log.schemas.js';
import type { AuditLog } from '../../generated/prisma/client.ts';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';

/**
 * The portal actor id of a patient of this provider, from the patient's current (decrypted) email.
 * Deleted patients are included: their history still matters. Null when the patient is not this
 * provider's or has no email, so the caller answers with an empty page like any other filter.
 */
async function portalActorIdForPatient(userId: string, patientId: string): Promise<string | null> {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, userId }, select: { email: true } });
  return patient?.email ? portalActorId(userId, patient.email) : null;
}

export const auditLogService = {
  findById(id: string, userId: string): Promise<AuditLog> {
    return auditLogRepository.findById(id, userId);
  },

  async findMany(userId: string, query: ListAuditLogsQuery): Promise<Paginated<AuditLog>> {
    const { portalPatientId, ...rest } = query;
    if (!portalPatientId) return auditLogRepository.findMany(userId, rest);

    const actorId = await portalActorIdForPatient(userId, portalPatientId);
    if (!actorId) return buildPaginatedResult<AuditLog>([], 0, query.page, query.pageSize);
    return auditLogRepository.findMany(userId, { ...rest, actorId });
  },

  async createOrThrow(dto: CreateAuditLogDto, tx?: TransactionClient) {
    const log = await auditLogRepository.create(dto, tx);
    logger.info({ auditLogId: log.id, entityType: log.entityType, entityId: log.entityId, actionType: log.actionType }, 'Audit log created');
    return log;
  },

  async create(dto: CreateAuditLogDto, tx?: TransactionClient) {
    try {
      return await auditLogService.createOrThrow(dto, tx);
    } catch (err) {
      logger.error({ err, entityType: dto.entityType, entityId: dto.entityId, actionType: dto.actionType }, 'Failed to create audit log');
    }
  },
};
