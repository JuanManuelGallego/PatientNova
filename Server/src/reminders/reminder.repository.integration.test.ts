import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../prisma/prismaClient.js';
import { reminderRepository } from './reminder.repository.js';
import { reminderService } from './reminder.service.js';
import {
  PatientNotFoundError,
  ReminderNotFoundError,
  ReminderNotCancellableError,
} from '../utils/errors.js';
import { createTestUser, createTestPatient } from '../../test/integration/helpers.js';
import { Channel, ReminderMode, ReminderStatus } from '../../generated/prisma/client.ts';

let userId: string;
let patientId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
});

function baseDto(overrides: Record<string, unknown> = {}) {
  return {
    channel: Channel.WHATSAPP,
    to: '+10000000000',
    sendMode: ReminderMode.IMMEDIATE,
    sendAt: new Date(Date.now() + 60_000),
    status: ReminderStatus.PENDING,
    patientId,
    contentSid: 'HXdummy',
    ...overrides,
  };
}

describe('reminderRepository (integration)', () => {
  it('creates and reads back a reminder', async () => {
    const created = await reminderRepository.create(baseDto(), userId);
    expect(created.id).toBeTruthy();
    expect(created.patientId).toBe(patientId);
    expect(created.userId).toBe(userId);

    const found = await reminderRepository.findById(created.id, userId);
    expect(found.to).toBe('+10000000000');
  });

  it('throws PatientNotFoundError for unknown patient', async () => {
    await expect(
      reminderRepository.create({ ...baseDto(), patientId: '00000000-0000-0000-0000-000000000000' }, userId),
    ).rejects.toThrow(PatientNotFoundError);
  });

  it('transitions status to SENT and stamps sentAt', async () => {
    const created = await reminderRepository.create(baseDto(), userId);
    const updated = await reminderRepository.update(created.id, { status: ReminderStatus.SENT }, userId);
    expect(updated.status).toBe(ReminderStatus.SENT);
    expect(updated.sentAt).toBeInstanceOf(Date);
  });

  it('cancels a PENDING reminder', async () => {
    const created = await reminderRepository.create(baseDto(), userId);
    const cancelled = await reminderRepository.cancel(created.id, userId);
    expect(cancelled.status).toBe(ReminderStatus.CANCELLED);
  });

  it('scopes findMany to the owning user', async () => {
    await reminderRepository.create(baseDto(), userId);
    const other = await createTestUser();
    const page = await reminderRepository.findMany({ page: 1, pageSize: 20, orderBy: 'sendAt', order: 'asc', includeDeleted: false }, other.id);
    expect(page.data).toHaveLength(0);
  });

  it('computes stats grouped by status and channel', async () => {
    await reminderRepository.create(baseDto({ channel: Channel.SMS }), userId);
    await reminderRepository.create(baseDto({ status: ReminderStatus.SENT }), userId);

    const stats = await reminderRepository.getStats({ includeDeleted: false }, userId);
    expect(stats.total).toBe(2);
    expect(stats.byChannel.SMS).toBe(1);
    expect(stats.byChannel.WHATSAPP).toBe(1);
    expect(stats.byStatus.PENDING).toBe(1);
    expect(stats.byStatus.SENT).toBe(1);
  });
});

describe('reminderService (integration, enqueue=false)', () => {
  it('creates a reminder without touching pg-boss', async () => {
    const created = await reminderService.create(baseDto(), userId, false);
    expect(created.id).toBeTruthy();
    expect(created.patientId).toBe(patientId);
  });

  it('refuses to cancel a non-PENDING reminder', async () => {
    const created = await reminderRepository.create(baseDto({ status: ReminderStatus.SENT }), userId);
    await expect(reminderService.cancel(created.id, userId))
      .rejects.toThrow(ReminderNotCancellableError);
  });

  it('throws ReminderNotFoundError on cancel of unknown id', async () => {
    await expect(reminderService.cancel('00000000-0000-0000-0000-000000000000', userId))
      .rejects.toThrow(ReminderNotFoundError);
  });
});

describe('reminderRepository (additional coverage)', () => {
  it('findMany filters by status and pagination', async () => {
    await reminderRepository.create(baseDto({ status: ReminderStatus.SENT }), userId);
    await reminderRepository.create(baseDto({ status: ReminderStatus.PENDING }), userId);

    const sentPage = await reminderRepository.findMany(
      { page: 1, pageSize: 20, orderBy: 'sendAt', order: 'asc', includeDeleted: false, status: ReminderStatus.SENT },
      userId,
    );
    expect(sentPage.data).toHaveLength(1);
    expect(sentPage.data[0]!.status).toBe(ReminderStatus.SENT);
    expect(sentPage.total).toBe(1);
  });

  it('getStats aggregates by status and channel', async () => {
    await reminderRepository.create(baseDto({ channel: Channel.SMS }), userId);
    await reminderRepository.create(baseDto({ status: ReminderStatus.SENT }), userId);

    const stats = await reminderRepository.getStats(
      { includeDeleted: false, patientId: undefined, dateFrom: undefined, dateTo: undefined },
      userId,
    );
    expect(stats.total).toBe(2);
    expect(stats.byChannel.SMS).toBe(1);
    expect(stats.byChannel.WHATSAPP).toBe(1);
    expect(stats.byStatus.PENDING).toBe(1);
    expect(stats.byStatus.SENT).toBe(1);
  });

  it('update stamps sentAt when moving to SENT and changes channel', async () => {
    const created = await reminderRepository.create(baseDto(), userId);
    const updated = await reminderRepository.update(created.id, { status: ReminderStatus.SENT, channel: Channel.SMS }, userId);

    expect(updated.status).toBe(ReminderStatus.SENT);
    expect(updated.channel).toBe(Channel.SMS);
    expect(updated.sentAt).toBeInstanceOf(Date);
  });

  it('soft-deletes and restores a reminder via the repository', async () => {
    const created = await reminderRepository.create(baseDto(), userId);
    await reminderRepository.delete(created.id, userId);

    // findById does not filter isDeleted, so assert exclusion via findMany + raw row
    const raw = await prisma.reminder.findUnique({ where: { id: created.id } });
    expect(raw!.isDeleted).toBe(true);

    const listed = await reminderRepository.findMany(
      { page: 1, pageSize: 20, orderBy: 'sendAt', order: 'asc', includeDeleted: false },
      userId,
    );
    expect(listed.data.find((r) => r.id === created.id)).toBeUndefined();

    const restored = await reminderRepository.restore(created.id, userId);
    expect(restored.isDeleted).toBe(false);

    const rawRestored = await prisma.reminder.findUnique({ where: { id: created.id } });
    expect(rawRestored!.isDeleted).toBe(false);
  });
});
