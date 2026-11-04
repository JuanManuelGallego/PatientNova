import { AsyncLocalStorage } from 'node:async_hooks';
import { ActionSource } from '../../generated/prisma/enums.js';

export interface AuditContext {
  actorId: string;
  actorDisplayName: string;
  ipAddress?: string | undefined;
  userId?: string | undefined;
  source?: ActionSource | undefined;
  /** Portal actions only: the patient record the action concerns, once resolved (see `bindAuditPortalPatient`). */
  portalPatientId?: string | undefined;
}

const auditStorage = new AsyncLocalStorage<AuditContext>();

export function runInAuditContext<T>(ctx: AuditContext, fn: () => T): T {
  // A copy, so binding a patient never leaks into the caller's context object.
  return auditStorage.run({ ...ctx }, fn);
}

/**
 * Tags the audit rows written later in the current portal action with the patient record it resolved to.
 * A no-op outside a portal audit context (provider requests, jobs, reads without a context).
 */
export function bindAuditPortalPatient(patientId: string): void {
  const ctx = auditStorage.getStore();
  if (ctx?.source === ActionSource.PUBLIC_PORTAL) ctx.portalPatientId = patientId;
}

export function getAuditContext(): AuditContext | undefined {
  return auditStorage.getStore();
}
