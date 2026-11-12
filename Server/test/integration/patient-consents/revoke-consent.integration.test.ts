import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: vi.fn().mockResolvedValue({ success: true, messageSid: 'msg-1' }) }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { auditLogService } from '../../../src/audit-log/audit-log.service.js';
import { ensureCurrentConsent, hasCurrentConsent } from '../../../src/patient-consents/patient-consent.service.js';
import { restorePatientAccess, revokePatientConsents } from '../../../src/patient-consents/consent-revocation.service.js';
import { sendReminderWorker } from '../../../src/scheduler/workers/send-reminder.js';
import { dispatchMessage } from '../../../src/scheduler/dispatch.js';
import {
  ActionSource,
  ActionType,
  BookingRequestKind,
  BookingRequestStatus,
  Channel,
  EntityType,
  ReminderMode,
  ReminderStatus,
} from '../../../generated/prisma/enums.js';
import { createTestPatient, createTestUser } from '../helpers.js';
import { createLiveProvider, createPendingRequestWithin, slotStarts, type LiveProvider } from '../portal/portal-helpers.js';

const POLICY = '2026-11-06';
const OLD_POLICY = '2026-10-01';
const UNKNOWN = '00000000-0000-4000-8000-000000000000';

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

const reminderFor = (userId: string, patientId: string, sendAt: Date) => prisma.reminder.create({
  data: {
    userId, patientId, channel: Channel.EMAIL, to: 'patient@test.local', subject: 'Recordatorio', body: 'Cita',
    sendMode: ReminderMode.SCHEDULED, sendAt, status: ReminderStatus.PENDING,
  },
});

async function liveRequest(provider: LiveProvider, slot: string, email: string) {
  const start = new Date(slot);
  return prisma.$transaction(async (tx) => (await createPendingRequestWithin(tx, provider.id, {
    kind: BookingRequestKind.NEW,
    email,
    name: 'Lucia',
    lastName: 'Rojas',
    phone: '+573001112233',
    typeId: provider.typeId,
    locationId: provider.locationId,
    startAt: start,
    endAt: new Date(start.getTime() + 3_600_000),
    patientTimezone: 'America/Bogota',
    policyVersion: POLICY,
    consentAcceptedAt: new Date(),
    consentIp: null,
    consentUserAgent: null,
  }, new Date())).request);
}

describe('revokePatientConsents', () => {
  afterEach(() => vi.restoreAllMocks());

  it('revokes every active consent of the patient, whatever its version', async () => {
    const { patient } = await seedPatient([ OLD_POLICY, POLICY ]);

    const result = await revokePatientConsents(patient.id);

    expect(result).toMatchObject({ revoked: 2, portalBlocked: false });
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

    expect(second).toMatchObject({ revoked: 0, portalBlocked: false });
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
    expect(audits[ 0 ]?.affectedFields).toEqual([ 'portalAccessEnabled' ]);
  });

  it('fails loudly for an unknown patient', async () => {
    await expect(revokePatientConsents(UNKNOWN)).rejects.toThrow('Patient not found');
  });

  it('revokes nothing when the audit row cannot be written', async () => {
    const { patient } = await seedPatient();
    vi.spyOn(auditLogService, 'createOrThrow').mockRejectedValue(new Error('audit down'));

    await expect(revokePatientConsents(patient.id)).rejects.toThrow('audit down');

    expect(await hasCurrentConsent(patient.id, POLICY)).toBe(true);
  });

  describe('messages', () => {
    it('keeps sending unless asked to stop', async () => {
      const { user, patient } = await seedPatient();
      const reminder = await reminderFor(user.id, patient.id, new Date(Date.now() + 86_400_000));

      const result = await revokePatientConsents(patient.id);

      expect(result).toMatchObject({ messagesStopped: false, remindersCancelled: 0 });
      expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).status).toBe(ReminderStatus.PENDING);
    });

    it('cancels pending reminders with one audit row each, and records the stop once', async () => {
      const { user, patient } = await seedPatient();
      const reminder = await reminderFor(user.id, patient.id, new Date(Date.now() + 86_400_000));

      const first = await revokePatientConsents(patient.id, { stopMessages: true });
      const second = await revokePatientConsents(patient.id, { stopMessages: true });

      expect(first).toMatchObject({ messagesStopped: true, remindersCancelled: 1 });
      expect(second).toMatchObject({ messagesStopped: false, remindersCancelled: 0 });
      expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).status).toBe(ReminderStatus.CANCELLED);
      expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).messagesStoppedAt).toBeInstanceOf(Date);
      const audits = await prisma.auditLog.findMany({ where: { userId: user.id, entityType: EntityType.REMINDER, entityId: reminder.id } });
      expect(audits).toHaveLength(1);
    });

    it('cancels a reminder created after the stop instead of sending it', async () => {
      const { user, patient } = await seedPatient();
      await revokePatientConsents(patient.id, { stopMessages: true });
      const reminder = await reminderFor(user.id, patient.id, new Date(Date.now() - 1000));

      await sendReminderWorker([ { data: { reminderId: reminder.id } } ]);

      expect(dispatchMessage).not.toHaveBeenCalled();
      expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).status).toBe(ReminderStatus.CANCELLED);
    });
  });

  describe('live booking requests', () => {
    const portal = config.portal as { patientEnabled: boolean };
    const wasEnabled = portal.patientEnabled;
    beforeAll(() => { portal.patientEnabled = true; });
    afterAll(() => { portal.patientEnabled = wasEnabled; });

    it('cancels the live requests sent from the patient\'s contact, and leaves others alone', async () => {
      const provider = await createLiveProvider();
      const patient = await createTestPatient(provider.id);
      const [ first, second ] = await slotStarts(provider);
      const mine = await liveRequest(provider, first!, patient.email!);
      const other = await liveRequest(provider, second!, 'otra@test.local');

      const result = await revokePatientConsents(patient.id);

      expect(result.requestsCancelled).toBe(1);
      expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe(BookingRequestStatus.CANCELLED);
      expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: other.id } })).status).toBe(BookingRequestStatus.PENDING);
    });

    it('also cancels a live unconfirmed hold of the patient contact, auditing its real previous status', async () => {
      const provider = await createLiveProvider();
      const patient = await createTestPatient(provider.id);
      const [ first ] = await slotStarts(provider);
      const held = await liveRequest(provider, first!, patient.email!);
      await prisma.bookingRequest.update({ where: { id: held.id }, data: { status: BookingRequestStatus.UNCONFIRMED } });

      const result = await revokePatientConsents(patient.id);

      expect(result.requestsCancelled).toBe(1);
      expect(await prisma.bookingRequest.findUniqueOrThrow({ where: { id: held.id } }))
        .toMatchObject({ status: BookingRequestStatus.CANCELLED, resolvedBy: 'system' });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: EntityType.BOOKING_REQUEST, entityId: held.id, actionType: ActionType.UPDATE },
      });
      expect(JSON.stringify(audit.fieldsBefore)).toContain('UNCONFIRMED');
    });
  });
});

describe('restorePatientAccess', () => {
  it('reopens the portal and messages, audited, and only what was asked', async () => {
    const { user, patient } = await seedPatient();
    await revokePatientConsents(patient.id, { blockPortal: true, stopMessages: true });

    const first = await restorePatientAccess(patient.id, { portal: true });
    const row = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });

    expect(first).toEqual({ portalRestored: true, messagesRestored: false });
    expect(row.portalAccessEnabled).toBe(true);
    expect(row.messagesStoppedAt).toBeInstanceOf(Date);
    expect(await hasCurrentConsent(patient.id, POLICY)).toBe(false);

    expect(await restorePatientAccess(patient.id, { messages: true })).toEqual({ portalRestored: false, messagesRestored: true });
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).messagesStoppedAt).toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: { userId: user.id, entityType: EntityType.PATIENT, entityId: patient.id, actionType: ActionType.UPDATE },
    });
    expect(audits.flatMap((a) => a.affectedFields).sort()).toEqual([
      'messagesStoppedAt', 'messagesStoppedAt', 'portalAccessEnabled', 'portalAccessEnabled',
    ]);
  });

  it('changes nothing when there is nothing to restore', async () => {
    const { patient } = await seedPatient();
    expect(await restorePatientAccess(patient.id, { portal: true, messages: true })).toEqual({ portalRestored: false, messagesRestored: false });
  });

  it('fails loudly for an unknown patient', async () => {
    await expect(restorePatientAccess(UNKNOWN, { portal: true })).rejects.toThrow('Patient not found');
  });
});
