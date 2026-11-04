import { z } from 'zod';
import { EntityType, ActionType, ActionSource } from '../../generated/prisma/enums';

const entityTypeEnum = z.enum(EntityType);
const actionTypeEnum = z.enum(ActionType);
const actionSourceEnum = z.enum(ActionSource);

export const createAuditLogSchema = z.object({
  userId: z.uuid(),
  actorId: z.string().min(1),
  actorDisplayName: z.string().min(1).max(200),
  entityType: entityTypeEnum,
  entityId: z.uuid(),
  actionType: actionTypeEnum,
  source: actionSourceEnum,
  description: z.string().min(1).max(500),
  affectedFields: z.array(z.string()).default([]),
  fieldsBefore: z.record(z.string(), z.unknown()).nullable().optional(),
  fieldsAfter: z.record(z.string(), z.unknown()).nullable().optional(),
  ipAddress: z.string().max(45).nullable().optional(),
});

export type CreateAuditLogDto = z.infer<typeof createAuditLogSchema>;

export const listAuditLogsSchema = z.object({
  entityType: z.union([ entityTypeEnum, z.array(entityTypeEnum) ]).optional(),
  entityId: z.uuid().optional(),
  actionType: z.union([ actionTypeEnum, z.array(actionTypeEnum) ]).optional(),
  source: z.union([ actionSourceEnum, z.array(actionSourceEnum) ]).optional(),
  actorId: z.string().optional(),
  /** Portal activity of one patient, matched by the portal actor id of the patient's current email. */
  portalPatientId: z.uuid().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  orderBy: z.enum([ 'eventTimeUtc', 'entityType', 'actionType', 'source', 'actorId' ]).default('eventTimeUtc'),
  order: z.enum([ 'asc', 'desc' ]).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).refine((query) => !(query.actorId && query.portalPatientId), {
  message: 'actorId and portalPatientId cannot be combined',
  path: [ 'portalPatientId' ],
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>;
