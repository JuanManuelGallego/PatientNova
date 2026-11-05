import { PatientStatus } from '../../generated/prisma/enums.js';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';
import { patientRepository } from '../patients/patient.repository.js';
import { bindAuditPortalPatient } from '../audit-log/audit-log-context.js';
import { contactHashOf, isPhoneContact, type PortalContact } from './portal-contact.js';

export interface PortalIdentity {
  userId: string;
  contact: PortalContact;
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
  const { active, hasDeleted, deletedRevoked } = match;
  if (active) {
    if (!active.portalAccessEnabled) return { kind: 'unavailable', review: false };
    return active.status === PatientStatus.ACTIVE
      ? { kind: 'patient', patientId: active.id }
      : { kind: 'unavailable', review: true };
  }
  if (!hasDeleted) return { kind: 'none' };
  return { kind: 'unavailable', review: !deletedRevoked };
}

type PhoneMatch = Awaited<ReturnType<typeof patientRepository.findPhoneMatches>>[number];

/** The number on this record is an identity: set by the provider, or endorsed. A number typed in the form never is. */
export function isTrustedPhoneMatch(row: Pick<PhoneMatch, 'whatsappHash' | 'smsHash' | 'whatsappUnverified'>, hash: string): boolean {
  return row.smsHash === hash || (row.whatsappHash === hash && !row.whatsappUnverified);
}

/**
 * A phone identifies a patient only when exactly one trusted active record has it. Several never auto-pick: a "who are you?"
 * would show one family member's name, and that they are a patient, to whoever holds the phone. Any revoked record fails
 * closed for the whole number.
 */
export function classifyPhoneMatch(rows: PhoneMatch[], hash: string): PortalPatientResolution {
  const active = rows.filter((r) => !r.isDeleted);
  if (active.some((r) => !r.portalAccessEnabled)) return { kind: 'unavailable', review: false };
  const trusted = active.filter((r) => isTrustedPhoneMatch(r, hash));
  if (active.length > 0 && trusted.length !== 1) return { kind: 'unavailable', review: true };
  const deleted = rows.filter((r) => r.isDeleted);
  return classifyPortalMatch({
    active: trusted[ 0 ] ?? null,
    hasDeleted: deleted.length > 0,
    deletedRevoked: deleted.some((r) => !r.portalAccessEnabled),
  });
}

async function matchContact(identity: PortalIdentity, hash: string, tx?: TransactionClient): Promise<PortalPatientResolution> {
  if (isPhoneContact(identity.contact)) return classifyPhoneMatch(await patientRepository.findPhoneMatches(identity.userId, hash, tx), hash);
  return classifyPortalMatch(await patientRepository.findPortalMatch(identity.userId, hash, tx));
}

export async function resolvePortalPatient(identity: PortalIdentity, tx?: TransactionClient): Promise<PortalPatientResolution> {
  const hash = contactHashOf(identity.contact);
  if (!hash) return { kind: 'none' };
  const resolution = await matchContact(identity, hash, tx);
  if (resolution.kind === 'patient') bindAuditPortalPatient(resolution.patientId);
  return resolution;
}
