import type { CreateAuditLogDto } from './audit-log.schemas.js';
import { getAuditContext } from './audit-log-context.js';
import { auditLogService } from './audit-log.service.js';
import { EntityType, ActionType, ActionSource } from '../../generated/prisma/enums';

/**
 * Compare two objects on the specified fields.
 * Returns affectedFields (field names that changed), fieldsBefore, and fieldsAfter
 * containing only the changed fields.
 */
export function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): { affectedFields: string[]; fieldsBefore: Record<string, unknown> | null; fieldsAfter: Record<string, unknown> | null } {
  const affectedFields: string[] = [];
  const fieldsBefore: Record<string, unknown> = {};
  const fieldsAfter: Record<string, unknown> = {};

  for (const field of fields) {
    const b = before[field];
    const a = after[field];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      affectedFields.push(field);
      fieldsBefore[field] = b;
      fieldsAfter[field] = a;
    }
  }

  return {
    affectedFields,
    fieldsBefore: affectedFields.length > 0 ? fieldsBefore : null,
    fieldsAfter: affectedFields.length > 0 ? fieldsAfter : null,
  };
}

/**
 * Build a CreateAuditLogDto from entity metadata, merging in the current
 * audit context (actor info from the request) and the computed diff.
 */
export function buildAuditEntry(overrides: Partial<CreateAuditLogDto>): CreateAuditLogDto {
  const ctx = getAuditContext();
  return {
    actorId: ctx?.actorId ?? 'system',
    actorDisplayName: ctx?.actorDisplayName ?? 'Sistema',
    entityType: EntityType.USER,
    entityId: '',
    actionType: ActionType.CREATE,
    source: ActionSource.API,
    description: '',
    affectedFields: [],
    ...overrides,
    ipAddress: 'ipAddress' in overrides ? overrides.ipAddress : ctx?.ipAddress,
    userId: 'userId' in overrides ? overrides.userId : ctx?.userId,
  };
}

export async function logAudit(params: {
  entityType: EntityType;
  entityId: string;
  actionType: ActionType;
  description: string;
  source?: ActionSource;
  affectedFields?: string[];
  fieldsBefore?: Record<string, unknown> | null;
  fieldsAfter?: Record<string, unknown> | null;
}): Promise<void> {
  await auditLogService.create(buildAuditEntry(params));
}
