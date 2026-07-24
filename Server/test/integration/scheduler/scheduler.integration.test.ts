import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock the dispatch boundary so the worker runs without hitting Twilio.
const dispatchMock = vi.fn().mockResolvedValue({
  success: true,
  messageSid: 'SMworker',
  channel: 'WHATSAPP',
  to: '+10000000000',
  sentAt: new Date().toISOString(),
});
vi.mock('../../../src/scheduler/dispatch.js', () => ({
  dispatchMessage: (...args: unknown[]) => dispatchMock(...args),
}));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { initializePgBoss, stopPgBoss, getBoss } from '../../../src/scheduler/pg-boss.js';
import { reminderJobManager } from '../../../src/scheduler/reminder-job-manager.js';
import { createTestUser, createTestPatient } from '../helpers.js';
import { ReminderStatus, Channel } from '../../../generated/prisma/client.ts';

let userId: string;
let patientId: string;

beforeAll(async () => {
  await initializePgBoss();
}, 30_000);

afterAll(async () => {
  // Remove any lingering enqueued jobs so they don't leak into other runs
  // (pg-boss lives in its own schema and is not truncated by the per-test setup).
  await prisma.$executeRawUnsafe(`DELETE FROM pgboss.job WHERE name = 'send-reminder'`);
  await stopPgBoss();
}, 30_000);

beforeEach(async () => {
  dispatchMock.mockClear();
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
});

async function waitForStatus(reminderId: string, status: ReminderStatus, timeoutMs = 15_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await prisma.reminder.findUnique({ where: { id: reminderId } });
    if (r && r.status === status) return r.status;
    await new Promise((res) => setTimeout(res, 250));
  }
  const final = await prisma.reminder.findUnique({ where: { id: reminderId } });
  throw new Error(`Reminder ${reminderId} did not reach ${status}; final=${final?.status}`);
}

describe('scheduler (integration, mocked dispatch)', () => {
  it('processes an enqueued reminder job and marks it QUEUED', async () => {
    const reminder = await prisma.reminder.create({
      data: {
        channel: Channel.WHATSAPP,
        to: '+10000000000',
        sendMode: 'IMMEDIATE',
        sendAt: new Date(Date.now() - 1000),
        status: ReminderStatus.PENDING,
        patientId,
        userId,
        contentSid: 'HXdummy',
      },
    });

    await reminderJobManager.enqueueImmediate(reminder.id);

    const finalStatus = await waitForStatus(reminder.id, ReminderStatus.QUEUED);
    expect(finalStatus).toBe(ReminderStatus.QUEUED);

    const updated = await prisma.reminder.findUnique({ where: { id: reminder.id } });
    expect(updated!.messageId).toBe('SMworker');
    expect(dispatchMock).toHaveBeenCalled();
  }, 30_000);

  it('does not process a non-PENDING reminder', async () => {
    const reminder = await prisma.reminder.create({
      data: {
        channel: Channel.WHATSAPP,
        to: '+10000000000',
        sendMode: 'IMMEDIATE',
        sendAt: new Date(Date.now() - 1000),
        status: ReminderStatus.CANCELLED,
        patientId,
        userId,
      },
    });

    await reminderJobManager.enqueueImmediate(reminder.id);
    await new Promise((res) => setTimeout(res, 2000));

    const updated = await prisma.reminder.findUnique({ where: { id: reminder.id } });
    expect(updated!.status).toBe(ReminderStatus.CANCELLED);
    expect(dispatchMock).not.toHaveBeenCalled();
  }, 30_000);

  it('exposes the pg-boss instance after initialization', () => {
    expect(getBoss()).toBeTruthy();
  });
});
