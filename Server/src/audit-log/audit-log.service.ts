import { auditLogRepository, type PortalPatientFilter } from './audit-log.repository.js';
import { logger } from '../utils/api/logger.js';
import { prisma } from '../utils/prisma/prisma-client.js';
import { buildPaginatedResult, type Paginated } from '../utils/api/pagination.js';
import { portalActorId } from './audit-actors.js';
import type { CreateAuditLogDto, ListAuditLogsQuery } from './audit-log.schemas.js';
import type { AuditLog } from '../../generated/prisma/client.ts';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';

async function portalPatientFilter(userId: string, patientId: string): Promise<PortalPatientFilter | null> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId },
    select: { email: true, whatsappNumber: true, whatsappUnverified: true, smsNumber: true },
  });
  if (!patient) return null;
  const contacts = [ patient.email, patient.whatsappUnverified ? null : patient.whatsappNumber, patient.smsNumber ];
  const actorIds = [ ...new Set(contacts.filter((c): c is string => !!c).map((c) => portalActorId(userId, c))) ];
  return { patientId, actorIds };
}

export const auditLogService = {
  findById(id: string, userId: string): Promise<AuditLog> {
    return auditLogRepository.findById(id, userId);
  },

  async findMany(userId: string, query: ListAuditLogsQuery): Promise<Paginated<AuditLog>> {
    const { portalPatientId, ...rest } = query;
    if (!portalPatientId) return auditLogRepository.findMany(userId, rest);

    const filter = await portalPatientFilter(userId, portalPatientId);
    if (!filter) return buildPaginatedResult<AuditLog>([], 0, query.page, query.pageSize);
    return auditLogRepository.findMany(userId, rest, filter);
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
