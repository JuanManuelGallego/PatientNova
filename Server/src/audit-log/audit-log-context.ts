import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuditContext {
  actorId: string;
  actorDisplayName: string;
  ipAddress?: string | undefined;
  userId?: string | undefined;
}

const auditStorage = new AsyncLocalStorage<AuditContext>();

export function runInAuditContext<T>(ctx: AuditContext, fn: () => T): T {
  return auditStorage.run(ctx, fn);
}

export function getAuditContext(): AuditContext | undefined {
  return auditStorage.getStore();
}
