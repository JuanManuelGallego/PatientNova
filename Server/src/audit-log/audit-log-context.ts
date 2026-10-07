import { AsyncLocalStorage } from 'node:async_hooks';
import type { ActionSource } from '../../generated/prisma/enums.js';

export interface AuditContext {
  actorId: string;
  actorDisplayName: string;
  ipAddress?: string | undefined;
  userId?: string | undefined;
  /** Overrides the default ActionSource.API for rows written inside this context. */
  source?: ActionSource | undefined;
}

const auditStorage = new AsyncLocalStorage<AuditContext>();

export function runInAuditContext<T>(ctx: AuditContext, fn: () => T): T {
  return auditStorage.run(ctx, fn);
}

export function getAuditContext(): AuditContext | undefined {
  return auditStorage.getStore();
}
