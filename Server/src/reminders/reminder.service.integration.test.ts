import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the scheduler job manager so the pg-boss-dependent service methods
// (cancel / softDelete / restore) run without a live pg-boss instance.
vi.mock('../scheduler/reminderJobManager.js', () => ({
  reminderJobManager: {
    enqueue: vi.fn().mockResolvedValue(undefined),
    enqueueImmediate: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    reschedule: vi.fn().mockResolvedValue(undefined),
    hasQueuedJob: vi.fn().mockResolvedValue(false),
  },
}));

import { prisma } from '../prisma/prismaClient.js';
import { reminderService } from './reminder.service.js';
import { reminderJobManager } from '../scheduler/reminderJobManager.js';
import { createTestUser, createTestPatient } from '../../test/integration/helpers.js';
import { Channel, ReminderMode, ReminderStatus } from '../../generated/prisma/client.ts';

const jobMock = reminderJobManager as unknown as {
  enqueue: ReturnType<typeof vi.fn>;
  enqueueImmediate: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  reschedule: ReturnType<typeof vi.fn>;
  hasQueuedJob: ReturnType<typeof vi.fn>;
};

let userId: string;
let patientId: string;

beforeEach(async () => {
  vi.clearAllMocks();
  jobMock.hasQueuedJob.mockResolvedValue(false);
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
});

function pendingDto(overrides: Record<string, unknown> = {}) {
  return {
    channel: Channel.WHATSAPP,
    to: '+10000000000',
    sendMode: ReminderMode.IMMEDIATE,
    sendAt: new Date(Date.now() + 60_000),
    status: ReminderStatus.PENDING,
    patientId,
    ...overrides,
  };
}

describe('reminderService (integration, pg-boss mocked)', () => {
  it('cancels a PENDING reminder and removes its job', async () => {
    const created = await reminderService.create(pendingDto(), userId, false);

    const cancelled = await reminderService.cancel(created.id, userId);

    expect(cancelled.status).toBe(ReminderStatus.CANCELLED);
    expect(jobMock.cancel).toHaveBeenCalledWith(created.id);

    const raw = await prisma.reminder.findUnique({ where: { id: created.id } });
    expect(raw!.status).toBe(ReminderStatus.CANCELLED);
  });

  it('soft-deletes a PENDING reminder and cancels its job', async () => {
    const created = await reminderService.create(pendingDto(), userId, false);

    const deleted = await reminderService.softDelete(created.id, userId);

    expect(deleted.isDeleted).toBe(true);
    expect(jobMock.cancel).toHaveBeenCalledWith(created.id);

    const raw = await prisma.reminder.findUnique({ where: { id: created.id } });
    expect(raw!.isDeleted).toBe(true);
  });

  it('restores a soft-deleted reminder and re-enqueues a future PENDING one', async () => {
    const created = await reminderService.create(pendingDto(), userId, false);
    await reminderService.softDelete(created.id, userId);
    jobMock.hasQueuedJob.mockResolvedValue(false);

    const restored = await reminderService.restore(created.id, userId);

    expect(restored.isDeleted).toBe(false);
    expect(jobMock.enqueue).toHaveBeenCalledWith(created.id, expect.any(Date));

    const raw = await prisma.reminder.findUnique({ where: { id: created.id } });
    expect(raw!.isDeleted).toBe(false);
  });

  it('restores a soft-deleted reminder without re-enqueuing a past one', async () => {
    const created = await reminderService.create(
      pendingDto({ sendAt: new Date(Date.now() - 60_000) }),
      userId,
      false,
    );
    await reminderService.softDelete(created.id, userId);
    jobMock.hasQueuedJob.mockResolvedValue(false);

    const restored = await reminderService.restore(created.id, userId);

    expect(restored.isDeleted).toBe(false);
    expect(jobMock.enqueue).not.toHaveBeenCalled();
  });

  it('reschedules a reminder when its sendAt changes', async () => {
    const created = await reminderService.create(
      pendingDto({ sendMode: ReminderMode.SCHEDULED }),
      userId,
      false,
    );

    const newSendAt = new Date(Date.now() + 3_600_000);
    await reminderService.update(created.id, { sendAt: newSendAt }, userId);

    expect(jobMock.reschedule).toHaveBeenCalledWith(created.id, expect.any(Date));

    const raw = await prisma.reminder.findUnique({ where: { id: created.id } });
    expect(raw!.sendAt.getTime()).toBe(newSendAt.getTime());
  });
});
