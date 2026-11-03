import { PatientStatus } from '../../generated/prisma/enums.js';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';
import { emailHash } from '../utils/encryption/blind-index.js';
import { patientRepository } from '../patients/patient.repository.js';

export interface PortalIdentity {
  userId: string;
  email: string;
}

export type PortalPatientResolution =
  | { kind: 'patient'; patientId: string }
  /**
   * `review`: an inactive or deleted-only match the provider may resolve through a REVIEW request (6.6). Revoked portal
   * access is never reviewable. Only the booking path reads `review`; every other caller treats both alike.
   */
  | { kind: 'unavailable'; review: boolean }
  | { kind: 'none' };

type PortalMatch = Awaited<ReturnType<typeof patientRepository.findPortalMatch>>;

export function classifyPortalMatch(match: PortalMatch): PortalPatientResolution {
  const { active, hasDeleted } = match;
  if (active) {
    if (!active.portalAccessEnabled) return { kind: 'unavailable', review: false };
    return active.status === PatientStatus.ACTIVE
      ? { kind: 'patient', patientId: active.id }
      : { kind: 'unavailable', review: true };
  }
  return hasDeleted ? { kind: 'unavailable', review: true } : { kind: 'none' };
}

export async function resolvePortalPatient(identity: PortalIdentity, tx?: TransactionClient): Promise<PortalPatientResolution> {
  const hash = emailHash(identity.email);
  if (!hash) return { kind: 'none' };
  return classifyPortalMatch(await patientRepository.findPortalMatch(identity.userId, hash, tx));
}
