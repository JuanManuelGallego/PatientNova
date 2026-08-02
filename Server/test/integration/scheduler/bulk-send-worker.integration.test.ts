import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the dispatch boundary so the bulk worker runs without touching Twilio.
const dispatchMock = vi.fn();
vi.mock('../../../src/scheduler/dispatch.js', () => ({
  dispatchMessage: (...args: unknown[]) => dispatchMock(...args),
}));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { bulkSendWorker } from '../../../src/scheduler/workers/bulk-send-message.js';
import { createTestUser, createTestPatient, futureDate } from '../helpers.js';
import { Channel, ReminderStatus } from '../../../generated/prisma/client.ts';
import { REMINDER_SEND_RETRY_LIMIT } from '../../../src/utils/config/constants.js';

let userId: string;
let patientId: string;

beforeEach(async () => {
  dispatchMock.mockReset();
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
});

afterEach(() => {
  vi.clearAllMocks();
});

async function createReminder(overrides: Record<string, unknown> = {}) {
  return prisma.reminder.create({
    data: {
      channel: Channel.WHATSAPP,
      to: '+57300123456',
      contentSid: 'HXbulktest',
      contentVariables: { '1': 'Maria Garcia' },
      sendMode: 'IMMEDIATE',
      sendAt: new Date(Date.now() - 1000),
      status: ReminderStatus.PENDING,
      patientId,
      userId,
      ...overrides,
    },
  });
}

describe('bulkSendWorker (integration, mocked dispatch)', () => {
  it('dispatches a valid PENDING reminder and marks it QUEUED', async () => {
    const reminder = await createReminder();
    dispatchMock.mockResolvedValue({
      success: true,
      messageSid: 'SMbulk1',
      channel: 'WHATSAPP',
      to: '+57300123456',
      sentAt: new Date().toISOString(),
    });

    await bulkSendWorker([{ data: { reminderId: reminder.id } }]);

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith(Channel.WHATSAPP, {
      to: '+57300123456',
      body: null,
      contentSid: 'HXbulktest',
      contentVariables: { '1': 'Maria Garcia' },
    });

    const updated = await prisma.reminder.findUnique({ where: { id: reminder.id } });
    expect(updated!.status).toBe(ReminderStatus.QUEUED);
    expect(updated!.messageId).toBe('SMbulk1');
    expect(updated!.sentAt).toBeTruthy();
  });

  it('skips a reminder that does not exist', async () => {
    await expect(bulkSendWorker([{ data: { reminderId: '00000000-0000-0000-0000-000000000000' } }])).resolves.toBeUndefined();
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('skips a reminder that is no longer PENDING', async () => {
    const reminder = await createReminder({ status: ReminderStatus.CANCELLED });

    await bulkSendWorker([{ data: { reminderId: reminder.id } }]);

    expect(dispatchMock).not.toHaveBeenCalled();
    const updated = await prisma.reminder.findUnique({ where: { id: reminder.id } });
    expect(updated!.status).toBe(ReminderStatus.CANCELLED);
  });

  it('skips a deleted reminder', async () => {
    const reminder = await createReminder({ isDeleted: true });

    await bulkSendWorker([{ data: { reminderId: reminder.id } }]);

    expect(dispatchMock).not.toHaveBeenCalled();
    const updated = await prisma.reminder.findUnique({ where: { id: reminder.id } });
    expect(updated!.status).toBe(ReminderStatus.PENDING);
  });

  it('skips a scheduled reminder whose sendAt is still in the future', async () => {
    const reminder = await createReminder({
      sendMode: 'SCHEDULED',
      sendAt: futureDate(60),
    });

    await bulkSendWorker([{ data: { reminderId: reminder.id } }]);

    expect(dispatchMock).not.toHaveBeenCalled();
    const updated = await prisma.reminder.findUnique({ where: { id: reminder.id } });
    expect(updated!.status).toBe(ReminderStatus.PENDING);
  });

  it('marks an invalid reminder FAILED without dispatching', async () => {
    // SMS reminder without a body can never be dispatched.
    const reminder = await createReminder({
      channel: Channel.SMS,
      contentSid: null,
      body: null,
    });

    await bulkSendWorker([{ data: { reminderId: reminder.id } }]);

    expect(dispatchMock).not.toHaveBeenCalled();
    const updated = await prisma.reminder.findUnique({ where: { id: reminder.id } });
    expect(updated!.status).toBe(ReminderStatus.FAILED);
    expect(updated!.error).toContain('Missing body');
  });

  it('throws on dispatch failure before the final retry and leaves the reminder PENDING', async () => {
    const reminder = await createReminder();
    dispatchMock.mockResolvedValue({
      success: false,
      error: 'Twilio down',
      channel: 'WHATSAPP',
      to: '+57300123456',
    });

    await expect(bulkSendWorker([{ data: { reminderId: reminder.id }, retryCount: 0 }])).rejects.toThrow('Twilio down');

    const updated = await prisma.reminder.findUnique({ where: { id: reminder.id } });
    expect(updated!.status).toBe(ReminderStatus.PENDING);
    expect(updated!.error).toBeNull();
  });

  it('marks the reminder FAILED on the final retry without throwing (no dead-letter noise)', async () => {
    const reminder = await createReminder();
    dispatchMock.mockResolvedValue({
      success: false,
      errorCode: 63002,
      error: 'Missing template variables',
      channel: 'WHATSAPP',
      to: '+57300123456',
    });

    const finalRetry = REMINDER_SEND_RETRY_LIMIT - 1;
    await expect(bulkSendWorker([{ data: { reminderId: reminder.id }, retryCount: finalRetry }])).resolves.toBeUndefined();

    const updated = await prisma.reminder.findUnique({ where: { id: reminder.id } });
    expect(updated!.status).toBe(ReminderStatus.FAILED);
    expect(updated!.error).toBe('Faltan parámetros variables obligatorios en la plantilla de WhatsApp.');
  });
});
