import type { AuditLog } from '../../generated/prisma/client.ts';
import { Prisma } from '../../generated/prisma/client.ts';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import type { CreateAuditLogDto, ListAuditLogsQuery } from './audit-log.schemas.js';
import { AuditLogNotFoundError } from './audit-log.errors.js';
import { paginate, type Paginated } from '../utils/api/pagination.js';

export const auditLogRepository = {
  async create(dto: CreateAuditLogDto, tx?: TransactionClient): Promise<AuditLog> {
    const client = tx ?? prisma;
    return client.auditLog.create({
      data: {
        userId: dto.userId ?? null,
        actorId: dto.actorId,
        actorDisplayName: dto.actorDisplayName,
        entityType: dto.entityType,
        entityId: dto.entityId,
        actionType: dto.actionType,
        source: dto.source,
        description: dto.description,
        affectedFields: dto.affectedFields,
        fieldsBefore: (dto.fieldsBefore as Prisma.InputJsonValue) ?? Prisma.DbNull,
        fieldsAfter: (dto.fieldsAfter as Prisma.InputJsonValue) ?? Prisma.DbNull,
        reason: dto.reason ?? null,
        ipAddress: dto.ipAddress ?? null,
      },
    });
  },

  async findById(id: string, userId: string): Promise<AuditLog> {
    const log = await prisma.auditLog.findFirst({ where: { id, userId } });
    if (!log) throw new AuditLogNotFoundError(id);
    return log;
  },

  async findMany(userId: string, query: ListAuditLogsQuery): Promise<Paginated<AuditLog>> {
    const { entityType, entityId, actionType, source, actorId, search, dateFrom, dateTo, orderBy, order, page, pageSize } = query;
    const eventTimeFilter: Prisma.DateTimeFilter = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo) }),
    };
    const where: Prisma.AuditLogWhereInput = { 
      userId,
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(actionType && { actionType }),
      ...(source && { source }),
      ...(actorId && { actorId }),
      ...(search && {
        OR: [
          { actorDisplayName: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { entityId: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(Object.keys(eventTimeFilter).length > 0 && { eventTimeUtc: eventTimeFilter }),
    };

    return paginate(
      prisma.auditLog.findMany({ 
        where, 
        orderBy: { [ orderBy ]: order }, 
        skip: (page - 1) * pageSize, 
        take: pageSize 
      }),
      prisma.auditLog.count({ where }),
      page,
      pageSize,
    );
  },
};
