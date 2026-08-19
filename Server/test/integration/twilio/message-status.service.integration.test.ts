import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { processMessageStatusCallback } from '../../../src/twilio/message-status.service.js';
import { createTestUser, createTestPatient } from '../helpers.js';
import { Channel, ReminderMode, ReminderStatus } from '../../../generated/prisma/client.ts';

async function createQueuedReminder(messageId: string, userId: string, patientId: string) {
  return prisma.reminder.create({
    data: {
      channel: Channel.WHATSAPP,
      to: '+57300123456',
      sendMode: ReminderMode.IMMEDIATE,
      status: ReminderStatus.QUEUED,
      sendAt: new Date(),
      messageId,
      patientId,
      userId,
    },
    select: { id: true, status: true, error: true, userId: true },
  });
}

async function statusOf(id: string) {
  const r = await prisma.reminder.findUnique({ where: { id }, select: { status: true, error: true } });
  return r!;
}

describe('processMessageStatusCallback (integration)', () => {
  let userId: string;
  let patientId: string;

  beforeEach(async () => {
    userId = (await createTestUser()).id;
    patientId = (await createTestPatient(userId)).id;
  });

  it('marks a delivered message as SENT', async () => {
    const r = await createQueuedReminder('SMdelivered', userId, patientId);

    await processMessageStatusCallback({ messageSid: 'SMdelivered', messageStatus: 'delivered' });

    const after = await statusOf(r.id);
    expect(after.status).toBe(ReminderStatus.SENT);
    expect(after.error).toBeNull();
  });

  it('marks a failed message as FAILED and resolves the error', async () => {
    const r = await createQueuedReminder('SMfailed', userId, patientId);

    await processMessageStatusCallback({
      messageSid: 'SMfailed',
      messageStatus: 'failed',
      errorCode: '30003',
      errorMessage: 'undeliverable',
    });

    const after = await statusOf(r.id);
    expect(after.status).toBe(ReminderStatus.FAILED);
    expect(typeof after.error).toBe('string');
    expect(after.error!.length).toBeGreaterThan(0);
  });

  it('ignores an unknown / queued status without mutating', async () => {
    const r = await createQueuedReminder('SMqueued', userId, patientId);

    await processMessageStatusCallback({ messageSid: 'SMqueued', messageStatus: 'queued' });

    const after = await statusOf(r.id);
    expect(after.status).toBe(ReminderStatus.QUEUED);
  });

  it('does nothing when no reminder matches the MessageSid', async () => {
    await processMessageStatusCallback({ messageSid: 'SMghost', messageStatus: 'delivered' });
    const all = await prisma.reminder.findMany({ where: { messageId: 'SMghost' } });
    expect(all).toHaveLength(0);
  });

  it('ignores a callback missing MessageSid without mutating other reminders', async () => {
    const r = await createQueuedReminder('SMvalid', userId, patientId);
    // An undefined MessageSid in Prisma's `where` would otherwise match all rows.
    await processMessageStatusCallback({ messageSid: '', messageStatus: 'delivered' });

    expect((await statusOf(r.id)).status).toBe(ReminderStatus.QUEUED);
  });

  it('ignores a callback missing MessageStatus', async () => {
    const r = await createQueuedReminder('SMnostatus', userId, patientId);
    await processMessageStatusCallback({ messageSid: 'SMnostatus', messageStatus: '' });

    expect((await statusOf(r.id)).status).toBe(ReminderStatus.QUEUED);
  });

  it('applies a late FAILED over an earlier SENT (out-of-order)', async () => {
    const r = await createQueuedReminder('SMorder1', userId, patientId);
    await processMessageStatusCallback({ messageSid: 'SMorder1', messageStatus: 'sent' });
    expect((await statusOf(r.id)).status).toBe(ReminderStatus.SENT);

    await processMessageStatusCallback({ messageSid: 'SMorder1', messageStatus: 'failed', errorCode: '30007' });
    expect((await statusOf(r.id)).status).toBe(ReminderStatus.FAILED);
  });

  it('ignores a stale SENT arriving after FAILED (out-of-order guard)', async () => {
    const r = await createQueuedReminder('SMorder2', userId, patientId);
    await processMessageStatusCallback({ messageSid: 'SMorder2', messageStatus: 'failed', errorCode: '30007' });
    expect((await statusOf(r.id)).status).toBe(ReminderStatus.FAILED);

    await processMessageStatusCallback({ messageSid: 'SMorder2', messageStatus: 'sent' });
    expect((await statusOf(r.id)).status).toBe(ReminderStatus.FAILED);
  });

  it('only touches the matching reminder (tenant isolation by messageId)', async () => {
    const otherUser = (await createTestUser()).id;
    const otherPatient = (await createTestPatient(otherUser)).id;

    const ra = await createQueuedReminder('SMa', userId, patientId);
    const rb = await createQueuedReminder('SMb', otherUser, otherPatient);

    await processMessageStatusCallback({ messageSid: 'SMa', messageStatus: 'delivered' });

    expect((await statusOf(ra.id)).status).toBe(ReminderStatus.SENT);
    expect((await statusOf(rb.id)).status).toBe(ReminderStatus.QUEUED);
  });
});
