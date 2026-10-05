import { describe, it, expect, beforeEach, vi } from 'vitest';

const dispatchMock = vi.fn();
vi.mock('../../../src/scheduler/dispatch.js', () => ({
  dispatchMessage: (...args: unknown[]) => dispatchMock(...args),
}));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { processBrevoEvents } from '../../../src/twilio/brevo-webhook.service.js';
import { createTestUser, createTestPatient } from '../helpers.js';
import { Channel, ReminderMode, ReminderStatus } from '../../../generated/prisma/client.ts';

const mid = (name: string) => `<202610021200.${name}@smtp-relay.mailin.fr>`;

async function createQueuedEmail(
  messageId: string,
  userId: string,
  patientId: string,
  status: ReminderStatus = ReminderStatus.QUEUED,
) {
  return prisma.reminder.create({
    data: {
      channel: Channel.EMAIL,
      to: 'maria@example.com',
      body: 'Hola',
      sendMode: ReminderMode.IMMEDIATE,
      status,
      sendAt: new Date(),
      messageId,
      patientId,
      userId,
    },
    select: { id: true },
  });
}

async function statusOf(id: string) {
  const r = await prisma.reminder.findUnique({ where: { id }, select: { status: true, error: true } });
  return r!;
}

describe('processBrevoEvents (integration)', () => {
  let userId: string;
  let patientId: string;

  beforeEach(async () => {
    dispatchMock.mockReset();
    dispatchMock.mockResolvedValue({ success: true, messageSid: 'alert', channel: 'EMAIL' });
    userId = (await createTestUser()).id;
    patientId = (await createTestPatient(userId)).id;
  });

  it('marks a delivered email as SENT', async () => {
    const r = await createQueuedEmail(mid('delivered'), userId, patientId);

    await processBrevoEvents([ { event: 'delivered', 'message-id': mid('delivered') } ]);

    const after = await statusOf(r.id);
    expect(after.status).toBe(ReminderStatus.SENT);
    expect(after.error).toBeNull();
  });

  it('marks a hard bounce FAILED with the reason and alerts the user by email', async () => {
    const r = await createQueuedEmail(mid('bounce'), userId, patientId);
    await prisma.user.update({ where: { id: userId }, data: { reminderActive: true, reminderChannel: Channel.EMAIL } });

    await processBrevoEvents([
      { event: 'hard_bounce', 'message-id': mid('bounce'), reason: '550 5.1.1 The email account does not exist' },
    ]);

    const after = await statusOf(r.id);
    expect(after.status).toBe(ReminderStatus.FAILED);
    expect(after.error).toBe('Email hard_bounce: 550 5.1.1 The email account does not exist');
    expect(dispatchMock).toHaveBeenCalledWith(Channel.EMAIL, expect.objectContaining({
      subject: expect.stringContaining('Recordatorio fallido'),
    }));
  });

  it.each([ 'blocked', 'invalid_email', 'error' ])('marks %s as FAILED', async (event) => {
    const r = await createQueuedEmail(mid(event), userId, patientId);

    await processBrevoEvents([ { event, 'message-id': mid(event) } ]);

    expect((await statusOf(r.id)).status).toBe(ReminderStatus.FAILED);
  });

  it('ignores informational and retryable events (request, deferred, soft_bounce, opened, spam)', async () => {
    const r = await createQueuedEmail(mid('info'), userId, patientId);

    await processBrevoEvents([ 'request', 'deferred', 'soft_bounce', 'opened', 'spam' ]
      .map((event) => ({ event, 'message-id': mid('info') })));

    expect((await statusOf(r.id)).status).toBe(ReminderStatus.QUEUED);
  });

  it('never downgrades FAILED to SENT on an out-of-order delivered event', async () => {
    const r = await createQueuedEmail(mid('order'), userId, patientId, ReminderStatus.FAILED);

    await processBrevoEvents([ { event: 'delivered', 'message-id': mid('order') } ]);

    expect((await statusOf(r.id)).status).toBe(ReminderStatus.FAILED);
  });

  it('is a no-op for unknown ids and keeps processing the rest of the batch', async () => {
    const r = await createQueuedEmail(mid('known'), userId, patientId);

    await expect(processBrevoEvents([
      { event: 'delivered', 'message-id': mid('ghost') },
      { event: 'delivered' },
      { event: 'delivered', 'message-id': mid('known') },
    ])).resolves.toBeUndefined();

    expect((await statusOf(r.id)).status).toBe(ReminderStatus.SENT);
  });
});
