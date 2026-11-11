import { ActionSource } from '../../generated/prisma/enums.js';
import { portalActorHash } from '../utils/encryption/blind-index.js';
import { maskContact, type PortalContact } from '../portal/portal-contact.js';
import type { AuditContext } from './audit-log-context.js';

export function bookingRequestExpiryAuditContext(userId: string): AuditContext {
  return {
    actorId: 'booking-request-expiry',
    actorDisplayName: 'Sistema (vencimiento de solicitudes)',
    userId,
    source: ActionSource.JOB,
  };
}

export function portalActorId(userId: string, contact: string): string {
  return `portal:${portalActorHash(userId, contact).slice(0, 24)}`;
}

export function portalPatientAuditContext(params: {
  userId: string;
  contact: PortalContact;
  ipAddress?: string | undefined;
}): AuditContext {
  return {
    actorId: portalActorId(params.userId, params.contact.value),
    actorDisplayName: `Paciente (portal) ${maskContact(params.contact)}`,
    ipAddress: params.ipAddress,
    userId: params.userId,
    source: ActionSource.PUBLIC_PORTAL,
  };
}

export const PORTAL_ANONYMOUS_ACTOR_ID = 'portal:anonymous';

export function portalAnonymousAuditContext(params: { userId: string; ipAddress?: string | undefined }): AuditContext {
  return {
    actorId: PORTAL_ANONYMOUS_ACTOR_ID,
    actorDisplayName: 'Paciente (portal, sin verificar)',
    ipAddress: params.ipAddress,
    userId: params.userId,
    source: ActionSource.PUBLIC_PORTAL,
  };
}
