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

export async function resolvePortalPatient(identity: PortalIdentity, tx?: TransactionClient): Promise<PortalPatientResolution> {
  const hash = emailHash(identity.email);
  if (!hash) return { kind: 'none' };
  return classifyPortalMatch(await patientRepository.findPortalMatch(identity.userId, hash, tx));
}
