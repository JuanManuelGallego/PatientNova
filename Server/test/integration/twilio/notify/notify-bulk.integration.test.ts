import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock pg-boss so the bulk route never touches a real queue/connection.
const bossMocks = vi.hoisted(() => ({
  getBoss: vi.fn(),
  send: vi.fn(),
}));

vi.mock('../../../../src/scheduler/pg-boss.js', () => ({
  getBoss: (...args: unknown[]) => bossMocks.getBoss(...args),
}));

import { prisma } from '../../../../src/utils/prisma/prisma-client.js';
import { notifyRouter } from '../../../../src/twilio/notify-sender.routes.js';
import { BULK_TEMPLATE_CONFIG } from '../../../../src/twilio/bulk-template-config.js';
import { createTestUser, createTestPatient, futureDate, invokeRoute } from '../../helpers.js';
import { Channel, ReminderMode, ReminderStatus } from '../../../../generated/prisma/client.ts';
import { EntityType, ActionType } from '../../../../generated/prisma/enums.ts';

const TEST_TEMPLATE_KEY = 'TEST_BULK_TEMPLATE';

let userId: string;
let patientId: string;

beforeEach(async () => {
  bossMocks.getBoss.mockReset().mockReturnValue({ send: bossMocks.send });
  bossMocks.send.mockReset().mockResolvedValue(undefined);
  BULK_TEMPLATE_CONFIG[TEST_TEMPLATE_KEY] = { contentSid: 'HXbulktest', canBulkSend: true };

  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
});

afterEach(() => {
  delete BULK_TEMPLATE_CONFIG[TEST_TEMPLATE_KEY];
});

async function patientWithNumber(userIdToUse = userId) {
  const p = await createTestPatient(userIdToUse);
  return prisma.patient.update({
    where: { id: p.id },
    data: { whatsappNumber: '+57300123456', smsNumber: '+57300123456' },
  });
}

function bulkBody(overrides: Record<string, unknown> = {}) {
  return {
    channel: Channel.WHATSAPP,
    templateKey: TEST_TEMPLATE_KEY,
    patientIds: [patientId],
    sendMode: ReminderMode.IMMEDIATE,
    ...overrides,
  };
}

async function invokeBulk(body: Record<string, unknown>) {
  return invokeRoute(notifyRouter, 'post', '/bulk', {
    user: { id: userId, timezone: 'America/Bogota' },
    ip: '127.0.0.1',
    body,
  });
}

function sendCalls() {
  return bossMocks.send.mock.calls as [
    queue: string,
    data: { reminderId: string },
    opts: { startAfter: Date },
  ][];
}

describe('POST /notify/bulk (integration, mocked boss)', () => {
  it('creates PENDING reminders, enqueues staggered jobs, and returns counts', async () => {
    const p1 = await patientWithNumber();
    const p2 = await patientWithNumber();

    const res = await invokeBulk(bulkBody({ patientIds: [p1.id, p2.id] }));

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toMatchObject({
      totalCount: 2,
      queuedCount: 2,
      skippedCount: 0,
      skippedPatientIds: [],
      channel: Channel.WHATSAPP,
      templateKey: TEST_TEMPLATE_KEY,
    });

    const reminders = await prisma.reminder.findMany({ where: { userId }, orderBy: { sendAt: 'asc' } });
    expect(reminders).toHaveLength(2);
    for (const r of reminders) {
      expect(r.status).toBe(ReminderStatus.PENDING);
      expect(r.channel).toBe(Channel.WHATSAPP);
      expect(r.contentSid).toBe('HXbulktest');
      expect(r.contentVariables).toMatchObject({ '1': 'Maria Garcia' });
    }

    const calls = sendCalls();
    expect(calls).toHaveLength(2);
    for (const [queue, data] of calls) {
      expect(queue).toBe('bulk-send-message');
      expect(reminders.map((r) => r.id)).toContain(data.reminderId);
    }
    // Immediate sends are staggered 2s apart from each reminder's sendAt.
    const [first, second] = calls;
    const gap = second![2].startAfter.getTime() - first![2].startAfter.getTime();
    expect(gap).toBeGreaterThanOrEqual(2000);
    expect(gap).toBeLessThan(2500);
    expect(first![2].startAfter.getTime()).toBeLessThanOrEqual(Date.now() + 5000);
  });

  it('honors sendAt for SCHEDULED sends (jobs fire at the requested time, not immediately)', async () => {
    const p = await patientWithNumber();
    const sendAt = futureDate(120);

    const res = await invokeBulk(bulkBody({
      patientIds: [p.id],
      sendMode: ReminderMode.SCHEDULED,
      sendAt: sendAt.toISOString(),
    }));

    expect(res.statusCode).toBe(201);

    const stored = await prisma.reminder.findFirst({ where: { userId } });
    expect(stored!.status).toBe(ReminderStatus.PENDING);
    expect(stored!.sendAt.getTime()).toBe(sendAt.getTime());

    const calls = sendCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![2].startAfter.getTime()).toBe(sendAt.getTime());
  });

  it('staggeres multiple scheduled jobs from sendAt', async () => {
    const p1 = await patientWithNumber();
    const p2 = await patientWithNumber();
    const sendAt = futureDate(120);

    const res = await invokeBulk(bulkBody({
      patientIds: [p1.id, p2.id],
      sendMode: ReminderMode.SCHEDULED,
      sendAt: sendAt.toISOString(),
    }));

    expect(res.statusCode).toBe(201);
    const calls = sendCalls();
    expect(calls).toHaveLength(2);
    const gap = calls[1]![2].startAfter.getTime() - calls[0]![2].startAfter.getTime();
    expect(gap).toBe(2000);
    expect(calls[0]![2].startAfter.getTime()).toBe(sendAt.getTime());
  });

  it('returns 400 for an unknown template', async () => {
    const res = await invokeBulk(bulkBody({ templateKey: 'DOES_NOT_EXIST' }));
    expect(res.statusCode).toBe(400);
    expect((res.body as any).error).toContain('not found');
    expect(await prisma.reminder.count()).toBe(0);
  });

  it('returns 403 for a template not enabled for bulk send', async () => {
    const res = await invokeBulk(bulkBody({ templateKey: 'PATIENT_WELCOME_MESSAGE' }));
    expect(res.statusCode).toBe(403);
    expect(await prisma.reminder.count()).toBe(0);
  });

  it('renders the SMS body per patient (shared variables + patient name) and enqueues', async () => {
    const p1 = await patientWithNumber();
    const p2 = await patientWithNumber();

    const res = await invokeBulk(bulkBody({
      channel: Channel.SMS,
      patientIds: [p1.id, p2.id],
      body: 'Hola {{1}}, su cita con {{2}} está confirmada.',
      sharedVariables: { '2': 'Dr. Lopez' },
    }));

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toMatchObject({
      totalCount: 2,
      queuedCount: 2,
      skippedCount: 0,
      channel: Channel.SMS,
    });

    const reminders = await prisma.reminder.findMany({ where: { userId } });
    expect(reminders).toHaveLength(2);
    for (const r of reminders) {
      expect(r.channel).toBe(Channel.SMS);
      expect(r.body).toBe('Hola Maria Garcia, su cita con Dr. Lopez está confirmada.');
      expect(r.contentSid).toBeNull();
      expect(r.status).toBe(ReminderStatus.PENDING);
    }
    expect(sendCalls()).toHaveLength(2);
  });

  it('leaves unresolved SMS placeholders untouched instead of dropping content', async () => {
    const p = await patientWithNumber();

    const res = await invokeBulk(bulkBody({
      channel: Channel.SMS,
      patientIds: [p.id],
      body: 'Hola {{1}}, código {{9}}',
    }));

    expect(res.statusCode).toBe(201);
    const reminder = await prisma.reminder.findFirst({ where: { userId } });
    expect(reminder!.body).toBe(`Hola ${p.name} ${p.lastName}, código {{9}}`);
  });

  it('returns 400 for SMS without a body', async () => {
    const res = await invokeBulk(bulkBody({ channel: Channel.SMS }));
    expect(res.statusCode).toBe(400);
    expect(await prisma.reminder.count()).toBe(0);
    expect(bossMocks.send).not.toHaveBeenCalled();
  });

  it('returns 400 when SCHEDULED sendAt is missing', async () => {
    const res = await invokeBulk(bulkBody({ sendMode: ReminderMode.SCHEDULED }));
    expect(res.statusCode).toBe(400);
    expect(await prisma.reminder.count()).toBe(0);
  });

  it('returns 400 when SCHEDULED sendAt is in the past', async () => {
    const res = await invokeBulk(bulkBody({
      sendMode: ReminderMode.SCHEDULED,
      sendAt: new Date(Date.now() - 60_000).toISOString(),
    }));
    expect(res.statusCode).toBe(400);
    expect(await prisma.reminder.count()).toBe(0);
  });

  it('returns 400 when sharedVariables exceed the size limit', async () => {
    const sharedVariables: Record<string, string> = {};
    for (let i = 0; i < 11; i++) sharedVariables[`k${i}`] = 'x';
    const res = await invokeBulk(bulkBody({ sharedVariables }));
    expect(res.statusCode).toBe(400);
    expect(await prisma.reminder.count()).toBe(0);
  });

  it('skips patients not owned by the user and reports them', async () => {
    const otherUser = await createTestUser();
    const otherPatient = await patientWithNumber(otherUser.id);

    const res = await invokeBulk(bulkBody({ patientIds: [otherPatient.id] }));

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toMatchObject({
      totalCount: 1,
      queuedCount: 0,
      skippedCount: 1,
      skippedPatientIds: [otherPatient.id],
    });
    expect(await prisma.reminder.count()).toBe(0);
    expect(bossMocks.send).not.toHaveBeenCalled();
  });

  it('skips patients without a number for the channel', async () => {
    const res = await invokeBulk(bulkBody({})); // created patient has no whatsappNumber

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toMatchObject({ queuedCount: 0, skippedCount: 1 });
    expect(res.body.data.skippedPatientIds).toEqual([patientId]);
    expect(await prisma.reminder.count()).toBe(0);
  });

  it('de-duplicates patient IDs so no duplicate reminders are created', async () => {
    const p = await patientWithNumber();

    const res = await invokeBulk(bulkBody({ patientIds: [p.id, p.id, p.id] }));

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toMatchObject({ totalCount: 1, queuedCount: 1 });
    expect(await prisma.reminder.count()).toBe(1);
    expect(sendCalls()).toHaveLength(1);
  });

  it('marks created reminders FAILED when enqueueing fails', async () => {
    const p1 = await patientWithNumber();
    const p2 = await patientWithNumber();
    bossMocks.send.mockRejectedValueOnce(new Error('queue down'));

    const res = await invokeBulk(bulkBody({ patientIds: [p1.id, p2.id] }));

    expect(res.statusCode).toBe(500);
    const reminders = await prisma.reminder.findMany({ where: { userId } });
    expect(reminders).toHaveLength(2);
    for (const r of reminders) {
      expect(r.status).toBe(ReminderStatus.FAILED);
      expect(r.error).toContain('Enqueue failed');
    }
  });

  it('returns 503 without creating reminders when the scheduler is not running', async () => {
    bossMocks.getBoss.mockImplementationOnce(() => {
      throw new Error('pg-boss not initialized');
    });

    const res = await invokeBulk(bulkBody({}));

    expect(res.statusCode).toBe(503);
    expect(await prisma.reminder.count()).toBe(0);
    expect(bossMocks.send).not.toHaveBeenCalled();
  });

  it('returns 201 with queuedCount 0 when every patient is skipped', async () => {
    const res = await invokeBulk(bulkBody({})); // no number for channel

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toMatchObject({ queuedCount: 0, skippedCount: 1 });
    expect(res.body.data.skippedPatientIds).toEqual([patientId]);
  });

  it('writes a CREATE audit entry per reminder', async () => {
    const p1 = await patientWithNumber();
    const p2 = await patientWithNumber();

    await invokeBulk(bulkBody({ patientIds: [p1.id, p2.id] }));

    const auditCount = await prisma.auditLog.count({
      where: { entityType: EntityType.REMINDER, actionType: ActionType.CREATE },
    });
    expect(auditCount).toBe(2);
  });
});
