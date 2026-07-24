// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reminderService } from '../../../src/reminders/reminder.service.js';

const mocks = vi.hoisted(() => ({
  repo: {
    findById: vi.fn(),
    findMany: vi.fn(),
    getStats: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
  },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: { $transaction: vi.fn() },
  fromPrisma: vi.fn(() => ({})),
  getBoss: vi.fn(),
  jobManager: {
    enqueue: vi.fn(),
    enqueueImmediate: vi.fn(),
    cancel: vi.fn(),
    reschedule: vi.fn(),
    hasQueuedJob: vi.fn(),
  },
}));

vi.mock('../../../src/reminders/reminder.repository.js', () => ({ reminderRepository: mocks.repo }));
vi.mock('../../../src/utils/api/logger.js', () => ({ logger: mocks.logger }));
vi.mock('../../../src/utils/prisma/prisma-client.js', () => ({ prisma: mocks.prisma }));
vi.mock('pg-boss', () => ({ fromPrisma: mocks.fromPrisma }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: mocks.getBoss }));
vi.mock('../../../src/scheduler/reminder-job-manager.js', () => ({ reminderJobManager: mocks.jobManager }));

const fakeReminder = {
  id: 'rem-1',
  channel: 'WHATSAPP',
  to: '+15551234567',
  sendMode: 'SCHEDULED',
  status: 'PENDING',
  patientId: 'patient-1',
  userId: 'user-1',
  sendAt: new Date(Date.now() + 86400000),
  createdAt: new Date(),
};

const scheduledPending = { ...fakeReminder };
const immediatePending = { ...fakeReminder, sendMode: 'IMMEDIATE' };

function txStub(overrides = {}) {
  return {
    patient: { findFirst: vi.fn().mockResolvedValue({ id: 'patient-1' }) },
    reminder: { create: vi.fn().mockResolvedValue(fakeReminder) },
    ...overrides,
  };
}

function bossStub() {
  const boss = { send: vi.fn().mockResolvedValue('job-1') };
  mocks.getBoss.mockReturnValue(boss);
  return boss;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.repo.findById.mockResolvedValue(fakeReminder);
  mocks.repo.findMany.mockResolvedValue({ items: [fakeReminder], total: 1 });
  mocks.repo.getStats.mockResolvedValue({ total: 10, todayCount: 2, byStatus: {}, byChannel: {} });
  mocks.repo.update.mockImplementation(async (id, dto) => ({ ...fakeReminder, ...dto }));
  mocks.repo.cancel.mockResolvedValue({ ...fakeReminder, status: 'CANCELLED' });
  mocks.repo.delete.mockResolvedValue(fakeReminder);
  mocks.repo.restore.mockResolvedValue(fakeReminder);
});

describe('reminderService.findById', () => {
  it('delegates to repository.findById', async () => {
    mocks.repo.findById.mockResolvedValue(fakeReminder);
    const result = await reminderService.findById('rem-1');
    expect(mocks.repo.findById).toHaveBeenCalledWith('rem-1');
    expect(result).toEqual(fakeReminder);
  });
});

describe('reminderService.findMany', () => {
  it('delegates to repository.findMany', async () => {
    const query = { page: 1, pageSize: 10, orderBy: 'sendAt', order: 'desc', search: '' };
    await reminderService.findMany(query, 'user-1');
    expect(mocks.repo.findMany).toHaveBeenCalledWith(query, 'user-1');
  });
});

describe('reminderService.getStats', () => {
  it('delegates to repository.getStats', async () => {
    const query = { dateFrom: '2024-01-01', dateTo: '2024-12-31' };
    await reminderService.getStats(query, 'user-1');
    expect(mocks.repo.getStats).toHaveBeenCalledWith(query, 'user-1');
  });
});

describe('reminderService.create', () => {
  it('IMMEDIATE: creates reminder and enqueues a pg-boss job inside the transaction', async () => {
    const dto = { channel: 'WHATSAPP', to: '+15551234567', sendMode: 'IMMEDIATE', patientId: 'patient-1', status: 'PENDING', sendAt: new Date().toISOString() };
    const tx = txStub();
    mocks.prisma.$transaction.mockImplementation(async (fn) => fn(tx));
    const boss = bossStub();

    const result = await reminderService.create(dto, 'user-1');

    expect(mocks.prisma.$transaction).toHaveBeenCalled();
    expect(tx.reminder.create).toHaveBeenCalled();
    expect(mocks.fromPrisma).toHaveBeenCalledWith(tx);
    expect(boss.send).toHaveBeenCalledWith('send-reminder', { reminderId: fakeReminder.id }, expect.objectContaining({ db: {} }));
    expect(result).toEqual(fakeReminder);
  });

  it('SCHEDULED: enqueues job with startAfter', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const dto = { channel: 'SMS', to: '+15559876543', sendMode: 'SCHEDULED', patientId: 'patient-1', status: 'PENDING', sendAt: future };
    const tx = txStub();
    mocks.prisma.$transaction.mockImplementation(async (fn) => fn(tx));
    const boss = bossStub();

    await reminderService.create(dto, 'user-1');

    const [, , options] = boss.send.mock.calls[0];
    expect(options.startAfter).toBeInstanceOf(Date);
    expect(options.db).toBeDefined();
  });

  it('throws ReminderSendAtInPastError for SCHEDULED with past sendAt', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const dto = { channel: 'WHATSAPP', to: '+15551234567', sendMode: 'SCHEDULED', patientId: 'patient-1', status: 'PENDING', sendAt: past };
    await expect(reminderService.create(dto, 'user-1')).rejects.toThrow('Scheduled reminders must have a sendAt time in the future');
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws PatientNotFoundError when patient does not exist', async () => {
    const dto = { channel: 'WHATSAPP', to: '+15551234567', sendMode: 'IMMEDIATE', patientId: 'missing', status: 'PENDING', sendAt: new Date().toISOString() };
    const tx = txStub({ patient: { findFirst: vi.fn().mockResolvedValue(null) }, reminder: { create: vi.fn() } });
    mocks.prisma.$transaction.mockImplementation(async (fn) => fn(tx));
    bossStub();
    await expect(reminderService.create(dto, 'user-1')).rejects.toThrow();
    expect(tx.reminder.create).not.toHaveBeenCalled();
  });

  it('enqueue:false creates the reminder but does NOT enqueue a pg-boss job (no duplicate send)', async () => {
    const dto = { channel: 'WHATSAPP', to: '+15551234567', sendMode: 'IMMEDIATE', patientId: 'patient-1', status: 'PENDING', sendAt: new Date().toISOString() };
    const tx = txStub();
    mocks.prisma.$transaction.mockImplementation(async (fn) => fn(tx));
    const boss = bossStub();

    await reminderService.create(dto, 'user-1', false);

    expect(tx.reminder.create).toHaveBeenCalled();
    expect(mocks.fromPrisma).not.toHaveBeenCalled();
    expect(boss.send).not.toHaveBeenCalled();
  });
});

describe('reminderService.update', () => {
  it('reschedules the job when sendAt changes on a PENDING reminder', async () => {
    mocks.repo.findById.mockResolvedValue(scheduledPending);
    await reminderService.update('rem-1', { sendAt: new Date(Date.now() + 2 * 86400000).toISOString() }, 'user-1');
    expect(mocks.jobManager.reschedule).toHaveBeenCalledWith('rem-1', expect.any(Date));
  });

  it('cancels + enqueues immediate when switching to IMMEDIATE on a SCHEDULED PENDING reminder', async () => {
    mocks.repo.findById.mockResolvedValue(scheduledPending);
    await reminderService.update('rem-1', { sendMode: 'IMMEDIATE' }, 'user-1');
    expect(mocks.jobManager.cancel).toHaveBeenCalledWith('rem-1');
    expect(mocks.jobManager.enqueueImmediate).toHaveBeenCalledWith('rem-1');
  });

  it('cancels the job when status transitions to non-PENDING', async () => {
    mocks.repo.findById.mockResolvedValue(scheduledPending);
    await reminderService.update('rem-1', { status: 'CANCELLED' }, 'user-1');
    expect(mocks.jobManager.cancel).toHaveBeenCalledWith('rem-1');
  });

  it('does not touch jobs for a plain field update', async () => {
    mocks.repo.findById.mockResolvedValue(scheduledPending);
    await reminderService.update('rem-1', { channel: 'SMS' }, 'user-1');
    expect(mocks.jobManager.reschedule).not.toHaveBeenCalled();
    expect(mocks.jobManager.cancel).not.toHaveBeenCalled();
    expect(mocks.jobManager.enqueueImmediate).not.toHaveBeenCalled();
  });
});

describe('reminderService.cancel', () => {
  it('cancels the pg-boss job then the reminder', async () => {
    mocks.repo.findById.mockResolvedValue(immediatePending);
    const result = await reminderService.cancel('rem-1', 'user-1');
    expect(mocks.jobManager.cancel).toHaveBeenCalledWith('rem-1');
    expect(mocks.repo.cancel).toHaveBeenCalledWith('rem-1', 'user-1');
    expect(result.status).toBe('CANCELLED');
  });

  it('throws ReminderNotCancellableError for a non-PENDING reminder', async () => {
    mocks.repo.findById.mockResolvedValue({ ...fakeReminder, status: 'SENT' });
    await expect(reminderService.cancel('rem-1', 'user-1')).rejects.toThrow('Cannot cancel a reminder with status "SENT"');
    expect(mocks.jobManager.cancel).not.toHaveBeenCalled();
  });
});

describe('reminderService.softDelete', () => {
  it('cancels the job when deleting a PENDING reminder', async () => {
    mocks.repo.findById.mockResolvedValue(immediatePending);
    await reminderService.softDelete('rem-1', 'user-1');
    expect(mocks.jobManager.cancel).toHaveBeenCalledWith('rem-1');
    expect(mocks.repo.delete).toHaveBeenCalledWith('rem-1', 'user-1');
  });

  it('does not cancel the job when deleting a non-PENDING reminder', async () => {
    mocks.repo.findById.mockResolvedValue({ ...fakeReminder, status: 'SENT' });
    await reminderService.softDelete('rem-1', 'user-1');
    expect(mocks.jobManager.cancel).not.toHaveBeenCalled();
    expect(mocks.repo.delete).toHaveBeenCalledWith('rem-1', 'user-1');
  });
});

describe('reminderService.restore', () => {
  it('re-enqueues when PENDING, future sendAt, and no existing job', async () => {
    mocks.repo.restore.mockResolvedValue({ ...fakeReminder, status: 'PENDING', sendAt: new Date(Date.now() + 86400000) });
    mocks.jobManager.hasQueuedJob.mockResolvedValue(false);
    await reminderService.restore('rem-1', 'user-1');
    expect(mocks.jobManager.enqueue).toHaveBeenCalledWith('rem-1', expect.any(Date));
  });

  it('skips re-enqueue when a queued job already exists', async () => {
    mocks.repo.restore.mockResolvedValue({ ...fakeReminder, status: 'PENDING', sendAt: new Date(Date.now() + 86400000) });
    mocks.jobManager.hasQueuedJob.mockResolvedValue(true);
    await reminderService.restore('rem-1', 'user-1');
    expect(mocks.jobManager.enqueue).not.toHaveBeenCalled();
  });

  it('skips re-enqueue for a non-PENDING restored reminder', async () => {
    mocks.repo.restore.mockResolvedValue({ ...fakeReminder, status: 'SENT' });
    await reminderService.restore('rem-1', 'user-1');
    expect(mocks.jobManager.enqueue).not.toHaveBeenCalled();
  });
});
