import { auditLogService } from './audit-log.service.js';
import { buildAuditEntry, computeDiff } from './audit-log.utils.js';
import { EntityType, ActionType, ActionSource } from '../../generated/prisma/enums.ts';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';

interface WithAuditConfig<TEntity extends { id: string }> {
  entityType: EntityType;
  action: AuditAction;

  description: ((entity: TEntity, ...args: any[]) => string) | string;

  affectedFields?: (entity: TEntity, ...args: any[]) => string[];
  fieldsAfter?:
    | ((entity: TEntity, ...args: any[]) => Record<string, unknown>)
    | string[];

  getBefore?: (id: string, ...args: any[]) => Promise<Record<string, unknown>>;
  diffFields?: string[];
  fieldsBefore?:
    | ((before: Record<string, unknown>, ...args: any[]) => Record<string, unknown>)
    | string[];

  source?: ActionSource;
}

export function withAudit<TEntity extends { id: string }>(
  fn: (...args: any[]) => Promise<TEntity>,
  config: WithAuditConfig<TEntity>,
): (...args: any[]) => Promise<TEntity> {
  return async (...args: any[]): Promise<TEntity> => {
    let before: Record<string, unknown> | null = null;
    if (config.getBefore && (config.action === 'UPDATE' || config.action === 'DELETE')) {
      before = await config.getBefore(args[0], ...args.slice(1));
    }

    const result = await fn(...args);

    const desc =
      typeof config.description === 'function'
        ? config.description(result, ...args)
        : config.description;

    let affectedFields: string[] = [];
    let fieldsBefore: Record<string, unknown> | null = null;
    let fieldsAfter: Record<string, unknown> | null = null;

    if (config.action === 'CREATE' || config.action === 'RESTORE') {
      if (config.fieldsAfter) {
        if (typeof config.fieldsAfter === 'function') {
          fieldsAfter = config.fieldsAfter(result, ...args);
        } else {
          fieldsAfter = Object.fromEntries(
            config.fieldsAfter.map((f) => [f, (result as Record<string, unknown>)[f]]),
          );
        }
      }
      if (config.affectedFields) {
        affectedFields = config.affectedFields(result, ...args);
      }
    } else if (config.action === 'UPDATE' && before) {
      if (config.diffFields) {
        const diff = computeDiff(
          before,
          result as unknown as Record<string, unknown>,
          config.diffFields,
        );
        affectedFields = diff.affectedFields;
        fieldsBefore = diff.fieldsBefore;
        fieldsAfter = diff.fieldsAfter;
      }
    } else if (config.action === 'DELETE' && before) {
      if (config.fieldsBefore) {
        if (typeof config.fieldsBefore === 'function') {
          fieldsBefore = config.fieldsBefore(before, ...args);
        } else {
          fieldsBefore = Object.fromEntries(
            config.fieldsBefore.map((f) => [f, before![f]]),
          );
        }
      }
    }

    await auditLogService.create(
      buildAuditEntry({
        entityType: config.entityType,
        entityId: result.id,
        actionType: ActionType[config.action],
        source: config.source ?? ActionSource.API,
        description: desc,
        affectedFields,
        fieldsBefore,
        fieldsAfter,
      }),
    );

    return result;
  };
}
