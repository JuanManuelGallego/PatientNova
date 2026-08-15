import type { AuditLog } from '../../generated/prisma/client.ts';
import { Prisma } from '../../generated/prisma/client.ts';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import type { CreateAuditLogDto, ListAuditLogsQuery } from './audit-log.schemas.js';
import { AuditLogNotFoundError } from './audit-log.errors.js';
import { paginate, buildPaginatedResult, type Paginated } from '../utils/api/pagination.js';

export const auditLogRepository = {
  async create(dto: CreateAuditLogDto, tx?: TransactionClient): Promise<AuditLog> {
    const client = tx ?? prisma;
    return client.auditLog.create({
      data: {
        userId: dto.userId,
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

    const needsInMemorySearch = search && search.trim().length > 0;

    const entityTypes = entityType ? (Array.isArray(entityType) ? entityType : [ entityType ]) : undefined;
    const actionTypes = actionType ? (Array.isArray(actionType) ? actionType : [ actionType ]) : undefined;

    const where: Prisma.AuditLogWhereInput = {
      userId,
      ...(entityTypes && { entityType: { in: entityTypes } }),
      ...(entityId && { entityId }),
      ...(actionTypes && { actionType: { in: actionTypes } }),
      ...(source && { source }),
      ...(actorId && { actorId }),
      // Encrypted fields (actorDisplayName, description) cannot be searched via SQL LIKE.
      // When search is provided, it's deferred to in-memory filtering after decryption.
      ...(Object.keys(eventTimeFilter).length > 0 && { eventTimeUtc: eventTimeFilter }),
    };

    if (!needsInMemorySearch) {
      return paginate(
        prisma.auditLog.findMany({
          where,
          orderBy: { [ orderBy ]: order },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.auditLog.count({ where }),
        page,
        pageSize,
      );
    }

    // In-memory search: fetch a superset, decrypt, filter, then paginate.
    const UPPERBOUND = 1000;
    const allRecords = await prisma.auditLog.findMany({
      where,
      orderBy: { [ orderBy ]: order },
      take: UPPERBOUND,
    });

    const lowerSearch = search!.toLowerCase();
    const matched = allRecords.filter((r) => {
      const haystack = `${r.actorDisplayName ?? ''} ${r.description ?? ''} ${r.entityId ?? ''}`.toLowerCase();
      return haystack.includes(lowerSearch);
    });

    const total = matched.length;
    const start = (page - 1) * pageSize;
    const paged = matched.slice(start, start + pageSize);

    return buildPaginatedResult(paged, total, page, pageSize);
  },
};
