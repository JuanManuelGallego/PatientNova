import { AsyncLocalStorage } from 'node:async_hooks';
import { ActionSource } from '../../generated/prisma/enums.js';

export interface AuditContext {
  actorId: string;
  actorDisplayName: string;
  ipAddress?: string | undefined;
  userId?: string | undefined;
  source?: ActionSource | undefined;
  portalPatientId?: string | undefined;
}

const auditStorage = new AsyncLocalStorage<AuditContext>();

export function runInAuditContext<T>(ctx: AuditContext, fn: () => T): T {
  return auditStorage.run({ ...ctx }, fn);
}

export function bindAuditPortalPatient(patientId: string): void {
  const ctx = auditStorage.getStore();
  if (ctx?.source === ActionSource.PUBLIC_PORTAL) ctx.portalPatientId = patientId;
}

export function getAuditContext(): AuditContext | undefined {
  return auditStorage.getStore();
}
