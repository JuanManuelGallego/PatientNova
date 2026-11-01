import { PatientStatus } from '../../generated/prisma/enums.js';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';
import { emailHash } from '../utils/encryption/blind-index.js';
import { patientRepository } from '../patients/patient.repository.js';

export interface PortalIdentity {
  userId: string;
  email: string;
}

/**
 * Outcome of matching a verified email to a provider's patient. It drives behavior only and must
 * never reach a response: callers answer the same shape for every outcome.
 *   - patient:     one active, non-deleted patient with portal access
 *   - unavailable: revoked (`portalAccessEnabled=false`), INACTIVE, or only soft-deleted matches (until 6.6)
 *   - none:        no patient has this email
 */
export type PortalPatientResolution =
  | { kind: 'patient'; patientId: string }
  | { kind: 'unavailable' }
  | { kind: 'none' };

type PortalMatch = Awaited<ReturnType<typeof patientRepository.findPortalMatch>>;

export function classifyPortalMatch(match: PortalMatch): PortalPatientResolution {
  const { active, hasDeleted } = match;
  if (active) {
    return active.status === PatientStatus.ACTIVE && active.portalAccessEnabled
      ? { kind: 'patient', patientId: active.id }
      : { kind: 'unavailable' };
  }
  return hasDeleted ? { kind: 'unavailable' } : { kind: 'none' };
}

/** The single stage-2 patient resolution for portal sessions. Never match portal patients any other way. */
export async function resolvePortalPatient(identity: PortalIdentity, tx?: TransactionClient): Promise<PortalPatientResolution> {
  const hash = emailHash(identity.email);
  if (!hash) return { kind: 'none' };
  return classifyPortalMatch(await patientRepository.findPortalMatch(identity.userId, hash, tx));
}
