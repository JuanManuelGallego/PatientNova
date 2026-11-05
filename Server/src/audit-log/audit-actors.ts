import { ActionSource } from '../../generated/prisma/enums.js';
import { maskEmail } from '../utils/api/logger.js';
import { portalActorHash } from '../utils/encryption/blind-index.js';
import type { AuditContext } from './audit-log-context.js';

export function bookingRequestExpiryAuditContext(userId: string): AuditContext {
  return {
    actorId: 'booking-request-expiry',
    actorDisplayName: 'Sistema (vencimiento de solicitudes)',
    userId,
    source: ActionSource.JOB,
  };
}

export function portalActorId(userId: string, email: string): string {
  return `portal:${portalActorHash(userId, email).slice(0, 24)}`;
}

export function portalPatientAuditContext(params: {
  userId: string;
  email: string;
  ipAddress?: string | undefined;
}): AuditContext {
  return {
    actorId: portalActorId(params.userId, params.email),
    actorDisplayName: `Paciente (portal) ${maskEmail(params.email)}`,
    ipAddress: params.ipAddress,
    userId: params.userId,
    source: ActionSource.PUBLIC_PORTAL,
  };
}
