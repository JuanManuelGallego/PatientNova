import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { auditLogService } from '../../../src/audit-log/audit-log.service.js';
import {
  ensureCurrentConsent,
  hasCurrentConsent,
  revokePatientConsents,
} from '../../../src/patient-consents/patient-consent.service.js';
import { ActionSource, ActionType, EntityType } from '../../../generated/prisma/enums.js';
import { createTestPatient, createTestUser } from '../helpers.js';

const POLICY = '2026-11-06';
const OLD_POLICY = '2026-10-01';

async function seedPatient(versions: string[] = [ POLICY ]) {
  const user = await createTestUser();
  const patient = await createTestPatient(user.id);
  for (const version of versions) {
    await prisma.$transaction((tx) => ensureCurrentConsent(tx, { patientId: patient.id, userId: user.id }, version));
  }
  return { user, patient };
}

const revocationAudits = (userId: string) => prisma.auditLog.findMany({
  where: { userId, entityType: EntityType.PATIENT_CONSENT, actionType: ActionType.UPDATE },
});

describe('revokePatientConsents', () => {
  afterEach(() => vi.restoreAllMocks());

  it('revokes every active consent of the patient, whatever its version', async () => {
    const { patient } = await seedPatient([ OLD_POLICY, POLICY ]);

    const result = await revokePatientConsents(patient.id);

    expect(result).toEqual({ revoked: 2, portalBlocked: false });
    const rows = await prisma.patientConsent.findMany({ where: { patientId: patient.id } });
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  it('writes one audit row per revoked consent, attributed to the operator and free of contact data', async () => {
    const { user, patient } = await seedPatient([ OLD_POLICY, POLICY ]);

    await revokePatientConsents(patient.id);

    const audits = await revocationAudits(user.id);
    expect(audits).toHaveLength(2);
    for (const audit of audits) {
      expect(audit.source).toBe(ActionSource.JOB);
      expect(audit.actorId).toBe('privacy-operator');
      expect(audit.affectedFields).toEqual([ 'revokedAt' ]);
      expect(JSON.stringify(audit)).not.toContain(patient.email);
    }
  });

  it('leaves the consents of other patients alone', async () => {
    const { patient } = await seedPatient();
    const { patient: other } = await seedPatient();

    await revokePatientConsents(patient.id);

    expect(await hasCurrentConsent(other.id, POLICY)).toBe(true);
  });

  it('lets the patient authorize again after a revocation', async () => {
    const { user, patient } = await seedPatient();

    await revokePatientConsents(patient.id);
    expect(await hasCurrentConsent(patient.id, POLICY)).toBe(false);

    await prisma.$transaction((tx) => ensureCurrentConsent(tx, { patientId: patient.id, userId: user.id }, POLICY));
    expect(await hasCurrentConsent(patient.id, POLICY)).toBe(true);
  });

  it('keeps the original revocation when run twice', async () => {
    const { user, patient } = await seedPatient();

    await revokePatientConsents(patient.id);
    const [ first ] = await prisma.patientConsent.findMany({ where: { patientId: patient.id } });
    const second = await revokePatientConsents(patient.id);

    expect(second).toEqual({ revoked: 0, portalBlocked: false });
    const [ again ] = await prisma.patientConsent.findMany({ where: { patientId: patient.id } });
    expect(again?.revokedAt).toEqual(first?.revokedAt);
    expect(await revocationAudits(user.id)).toHaveLength(1);
  });

  it('keeps portal access unless asked to block it', async () => {
    const { patient } = await seedPatient();

    await revokePatientConsents(patient.id);

    const row = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(row.portalAccessEnabled).toBe(true);
  });

  it('blocks portal access on request and audits the change once', async () => {
    const { user, patient } = await seedPatient();

    const first = await revokePatientConsents(patient.id, { blockPortal: true });
    const second = await revokePatientConsents(patient.id, { blockPortal: true });

    expect(first.portalBlocked).toBe(true);
    expect(second.portalBlocked).toBe(false);
    const row = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(row.portalAccessEnabled).toBe(false);
    const audits = await prisma.auditLog.findMany({
      where: { userId: user.id, entityType: EntityType.PATIENT, entityId: patient.id, actionType: ActionType.UPDATE },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.affectedFields).toEqual([ 'portalAccessEnabled' ]);
  });

  it('fails loudly for an unknown patient', async () => {
    await expect(revokePatientConsents('00000000-0000-4000-8000-000000000000')).rejects.toThrow('Patient not found');
  });

  it('revokes nothing when the audit row cannot be written', async () => {
    const { patient } = await seedPatient();
    vi.spyOn(auditLogService, 'createOrThrow').mockRejectedValue(new Error('audit down'));

    await expect(revokePatientConsents(patient.id)).rejects.toThrow('audit down');

    expect(await hasCurrentConsent(patient.id, POLICY)).toBe(true);
  });
});
