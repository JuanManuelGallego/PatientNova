import { ActionType, ConsentKind, EntityType } from '../../generated/prisma/enums.js';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { patientConsentRepository } from './patient-consent.repository.js';

export interface ConsentRequestMeta {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Records the patient's data-processing consent for `policyVersion` once. Idempotent and race-safe:
 * concurrent callers leave one row, and only the caller that inserted it writes the audit row
 * (inside `tx`, required). The only way to record consent (Phase 3 session, 4.1 booking, 6.3).
 */
export async function ensureCurrentConsent(
  tx: TransactionClient,
  patient: { patientId: string; userId: string },
  policyVersion: string,
  meta: ConsentRequestMeta = {},
) {
  const kind = ConsentKind.DATA_PROCESSING;
  const created = await patientConsentRepository.insertIfAbsent(tx, {
    patientId: patient.patientId,
    userId: patient.userId,
    kind,
    policyVersion,
    acceptedAt: new Date(),
    ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
    userAgent: meta.userAgent?.slice(0, 512) ?? null,
  });
  const consent = await patientConsentRepository.findActive(patient.patientId, kind, policyVersion, tx);
  if (!consent) throw new Error('Active patient consent missing after insert');

  if (created) {
    await logAudit({
      entityType: EntityType.PATIENT_CONSENT,
      entityId: consent.id,
      userId: patient.userId,
      actionType: ActionType.CREATE,
      description: `Consentimiento de tratamiento de datos aceptado (política ${policyVersion})`,
      affectedFields: [ 'kind', 'policyVersion', 'acceptedAt', 'patientId' ],
      fieldsAfter: {
        kind: consent.kind,
        policyVersion: consent.policyVersion,
        acceptedAt: consent.acceptedAt,
        patientId: consent.patientId,
      },
      tx,
      required: true,
    });
  }
  return { consent, created };
}

export async function hasCurrentConsent(patientId: string, policyVersion: string, tx?: TransactionClient): Promise<boolean> {
  return (await patientConsentRepository.findActive(patientId, ConsentKind.DATA_PROCESSING, policyVersion, tx)) !== null;
}
