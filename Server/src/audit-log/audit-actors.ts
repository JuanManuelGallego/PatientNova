import { createHash } from 'node:crypto';
import { ActionSource } from '../../generated/prisma/enums.js';
import { maskEmail } from '../utils/api/logger.js';
import type { AuditContext } from './audit-log-context.js';

/**
 * Audit actor for a verified-email portal patient. The actor id is a stable hash of
 * (provider, email) so rows can be correlated without storing the raw address, and the display
 * name only carries a masked email.
 */
export function portalPatientAuditContext(params: {
  userId: string;
  email: string;
  ipAddress?: string | undefined;
}): AuditContext {
  const actorId = `portal:${createHash('sha256').update(`${params.userId}:${params.email}`).digest('hex').slice(0, 24)}`;
  return {
    actorId,
    actorDisplayName: `Paciente (portal) ${maskEmail(params.email)}`,
    ipAddress: params.ipAddress,
    userId: params.userId,
    source: ActionSource.PUBLIC_PORTAL,
  };
}
