import { ActionSource } from '../../generated/prisma/enums.js';
import { maskEmail } from '../utils/api/logger.js';
import { portalActorHash } from '../utils/encryption/blind-index.js';
import type { AuditContext } from './audit-log-context.js';

/**
 * A booking request whose hold ran out is expired by the clock, not by whoever's action swept it, so the
 * audit row never carries that caller's actor or IP (another patient's booking may be what triggered it).
 */
export function bookingRequestExpiryAuditContext(userId: string): AuditContext {
  return {
    actorId: 'booking-request-expiry',
    actorDisplayName: 'Sistema (vencimiento de solicitudes)',
    userId,
    source: ActionSource.JOB,
  };
}

export function portalPatientAuditContext(params: {
  userId: string;
  email: string;
  ipAddress?: string | undefined;
}): AuditContext {
  const actorId = `portal:${portalActorHash(params.userId, params.email).slice(0, 24)}`;
  return {
    actorId,
    actorDisplayName: `Paciente (portal) ${maskEmail(params.email)}`,
    ipAddress: params.ipAddress,
    userId: params.userId,
    source: ActionSource.PUBLIC_PORTAL,
  };
}
