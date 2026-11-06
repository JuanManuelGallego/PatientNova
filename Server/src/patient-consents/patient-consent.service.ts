import { ActionSource, ActionType, ConsentKind, EntityType } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { patientConsentRepository } from './patient-consent.repository.js';

const PRIVACY_OPERATOR = {
  actorId: 'privacy-operator',
  actorDisplayName: 'Operador de privacidad',
  source: ActionSource.JOB,
};

export interface ConsentRequestMeta {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function ensureCurrentConsent(
  tx: TransactionClient,
  patient: { patientId: string; userId: string },
  policyVersion: string,
  meta: ConsentRequestMeta = {},
  /** When the patient accepted; defaults to now. Approval passes the time stored on the booking request. */
  acceptedAt: Date = new Date(),
) {
  const kind = ConsentKind.DATA_PROCESSING;
  const created = await patientConsentRepository.insertIfAbsent(tx, {
    patientId: patient.patientId,
    userId: patient.userId,
    kind,
    policyVersion,
    acceptedAt,
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

/**
 * Operator action behind the manual revocation procedure in `docs/compliance-patient-data.md`, section 4.
 * Consent only gates the portal: this does not stop reminders, cancel appointments or touch pending requests.
 */
export async function revokePatientConsents(
  patientId: string,
  options: { blockPortal?: boolean } = {},
): Promise<{ revoked: number; portalBlocked: boolean }> {
  return runInAuditContext(PRIVACY_OPERATOR, () => prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({
      where: { id: patientId },
      select: { userId: true, portalAccessEnabled: true },
    });
    if (!patient) throw new Error('Patient not found');

    const revokedAt = new Date();
    const consents = await patientConsentRepository.findAllActive(patientId, tx);
    for (const consent of consents) {
      await patientConsentRepository.markRevoked(consent.id, revokedAt, tx);
      await logAudit({
        entityType: EntityType.PATIENT_CONSENT,
        entityId: consent.id,
        userId: patient.userId,
        actionType: ActionType.UPDATE,
        description: `Consentimiento de tratamiento de datos revocado (política ${consent.policyVersion})`,
        affectedFields: [ 'revokedAt' ],
        fieldsBefore: { revokedAt: null },
        fieldsAfter: { revokedAt },
        tx,
        required: true,
      });
    }

    const portalBlocked = options.blockPortal === true && patient.portalAccessEnabled;
    if (portalBlocked) {
      await tx.patient.update({ where: { id: patientId }, data: { portalAccessEnabled: false } });
      await logAudit({
        entityType: EntityType.PATIENT,
        entityId: patientId,
        userId: patient.userId,
        actionType: ActionType.UPDATE,
        description: 'Acceso al portal desactivado por revocación del consentimiento',
        affectedFields: [ 'portalAccessEnabled' ],
        fieldsBefore: { portalAccessEnabled: true },
        fieldsAfter: { portalAccessEnabled: false },
        tx,
        required: true,
      });
    }

    return { revoked: consents.length, portalBlocked };
  }));
}
