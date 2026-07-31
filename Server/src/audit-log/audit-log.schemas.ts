import { z } from 'zod';
import { EntityType, ActionType, ActionSource } from '../../generated/prisma/enums';

const entityTypeEnum = z.nativeEnum(EntityType);
const actionTypeEnum = z.nativeEnum(ActionType);
const actionSourceEnum = z.nativeEnum(ActionSource);

export const createAuditLogSchema = z.object({
  userId: z.string().uuid().optional(),
  actorId: z.string().min(1),
  actorDisplayName: z.string().min(1).max(200),
  entityType: entityTypeEnum,
  entityId: z.string().min(1),
  actionType: actionTypeEnum,
  source: actionSourceEnum,
  description: z.string().min(1).max(500),
  affectedFields: z.array(z.string()).default([]),
  fieldsBefore: z.record(z.string(), z.unknown()).nullable().optional(),
  fieldsAfter: z.record(z.string(), z.unknown()).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  ipAddress: z.string().max(45).nullable().optional(),
});

export type CreateAuditLogDto = z.infer<typeof createAuditLogSchema>;

export const listAuditLogsSchema = z.object({
  entityType: entityTypeEnum.optional(),
  entityId: z.string().optional(),
  actionType: actionTypeEnum.optional(),
  source: actionSourceEnum.optional(),
  actorId: z.string().optional(),
  orderBy: z.enum([ 'eventTimeUtc', 'entityType', 'actionType', 'source', 'actorId' ]).default('eventTimeUtc'),
  order: z.enum([ 'asc', 'desc' ]).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>;
