import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { blockedTimeRepository } from '../../../src/blocked-time/blocked-time.repository.js';
import { BlockedTimeNotFoundError } from '../../../src/blocked-time/blocked-time.errors.js';
import { createTestUser, appointmentTimeRange } from '../helpers.js';

let userId: string;

beforeEach(async () => {
  const u = await createTestUser();
  userId = u.id;
});

describe('blockedTimeRepository (integration)', () => {
  it('creates and reads back a blocked time slot', async () => {
    const { start, end } = appointmentTimeRange(60, 60);
    const created = await blockedTimeRepository.create(
      { description: 'Lunch break', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
      userId,
    );
    expect(created.id).toBeTruthy();
    expect(created.description).toBe('Lunch break');
    expect(created.userId).toBe(userId);
    expect(created.isDeleted).toBe(false);

    const found = await blockedTimeRepository.findById(created.id, userId);
    expect(found.id).toBe(created.id);
    expect(found.description).toBe('Lunch break');
  });

  it('creates with null description', async () => {
    const { start, end } = appointmentTimeRange(60, 60);
    const created = await blockedTimeRepository.create(
      { startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
      userId,
    );
    expect(created.description).toBeNull();
  });

  it('throws BlockedTimeNotFoundError for unknown id', async () => {
    await expect(
      blockedTimeRepository.findById('00000000-0000-0000-0000-000000000000', userId),
    ).rejects.toThrow(BlockedTimeNotFoundError);
  });

  it('throws BlockedTimeNotFoundError for non-owned id', async () => {
    const { start, end } = appointmentTimeRange(60, 60);
    const created = await blockedTimeRepository.create(
      { description: 'Private', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
      userId,
    );
    const other = await createTestUser();
    await expect(
      blockedTimeRepository.findById(created.id, other.id),
    ).rejects.toThrow(BlockedTimeNotFoundError);
  });

  it('findMany returns paginated results scoped to user', async () => {
    const { start, end } = appointmentTimeRange(60, 60);
    await blockedTimeRepository.create(
      { description: 'A', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
      userId,
    );

    const result = await blockedTimeRepository.findMany(userId, {
      page: 1, pageSize: 20, orderBy: 'createdAt', order: 'desc', includeDeleted: false,
    });
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.data.every((bt) => bt.userId === userId)).toBe(true);
  });

  it('findMany scopes to user — other users data is excluded', async () => {
    const other = await createTestUser();
    const { start, end } = appointmentTimeRange(60, 60);
    await blockedTimeRepository.create(
      { description: 'Other', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
      other.id,
    );

    const result = await blockedTimeRepository.findMany(userId, {
      page: 1, pageSize: 20, orderBy: 'createdAt', order: 'desc', includeDeleted: false,
    });
    expect(result.data).toHaveLength(0);
  });

  it('findMany filters by date range (from/to)', async () => {
    const now = Date.now();
    const earlyStart = new Date(now + 120 * 60_000);
    const earlyEnd = new Date(earlyStart.getTime() + 60 * 60_000);
    await blockedTimeRepository.create(
      { description: 'Early', startTimeUtc: earlyStart.toISOString(), endTimeUtc: earlyEnd.toISOString() },
      userId,
    );

    const lateStart = new Date(now + 480 * 60_000);
    const lateEnd = new Date(lateStart.getTime() + 60 * 60_000);
    await blockedTimeRepository.create(
      { description: 'Late', startTimeUtc: lateStart.toISOString(), endTimeUtc: lateEnd.toISOString() },
      userId,
    );

    const result = await blockedTimeRepository.findMany(userId, {
      page: 1, pageSize: 20, orderBy: 'startTimeUtc', order: 'asc',
      includeDeleted: false, from: earlyStart.toISOString(), to: earlyEnd.toISOString(),
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.description).toBe('Early');
  });

  it('findMany excludes soft-deleted by default', async () => {
    const { start, end } = appointmentTimeRange(60, 60);
    const created = await blockedTimeRepository.create(
      { description: 'Gone', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
      userId,
    );
    await blockedTimeRepository.delete(created.id, userId);

    const result = await blockedTimeRepository.findMany(userId, {
      page: 1, pageSize: 20, orderBy: 'createdAt', order: 'desc', includeDeleted: false,
    });
    expect(result.data.find((bt) => bt.id === created.id)).toBeUndefined();
  });

  it('findMany includes soft-deleted when includeDeleted=true', async () => {
    const { start, end } = appointmentTimeRange(60, 60);
    const created = await blockedTimeRepository.create(
      { description: 'Gone', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
      userId,
    );
    await blockedTimeRepository.delete(created.id, userId);

    const result = await blockedTimeRepository.findMany(userId, {
      page: 1, pageSize: 20, orderBy: 'createdAt', order: 'desc', includeDeleted: true,
    });
    expect(result.data.find((bt) => bt.id === created.id)).toBeTruthy();
  });

  it('updates a blocked time slot', async () => {
    const { start, end } = appointmentTimeRange(60, 60);
    const created = await blockedTimeRepository.create(
      { description: 'Old', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
      userId,
    );

    const updated = await blockedTimeRepository.update(created.id, { description: 'New' }, userId);
    expect(updated.description).toBe('New');
    expect(updated.id).toBe(created.id);
  });

  it('soft-deletes and restores a blocked time slot', async () => {
    const { start, end } = appointmentTimeRange(60, 60);
    const created = await blockedTimeRepository.create(
      { description: 'Temp', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
      userId,
    );

    await blockedTimeRepository.delete(created.id, userId);
    const raw = await prisma.blockedTime.findUnique({ where: { id: created.id } });
    expect(raw!.isDeleted).toBe(true);
    expect(raw!.deletedAt).toBeInstanceOf(Date);

    const restored = await blockedTimeRepository.restore(created.id, userId);
    expect(restored.isDeleted).toBe(false);
    const rawRestored = await prisma.blockedTime.findUnique({ where: { id: created.id } });
    expect(rawRestored!.isDeleted).toBe(false);
  });

  it('findById finds soft-deleted when includeDeleted=true', async () => {
    const { start, end } = appointmentTimeRange(60, 60);
    const created = await blockedTimeRepository.create(
      { description: 'Hidden', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
      userId,
    );
    await blockedTimeRepository.delete(created.id, userId);

    const found = await blockedTimeRepository.findById(created.id, userId, true);
    expect(found.id).toBe(created.id);
    expect(found.isDeleted).toBe(true);
  });

  describe('hasBlockedTimeOverlap', () => {
    it('returns the overlapping blocked time when one exists', async () => {
      const { start, end } = appointmentTimeRange(60, 60);
      await blockedTimeRepository.create(
        { description: 'Conflict', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
        userId,
      );

      const overlap = await blockedTimeRepository.hasBlockedTimeOverlap(userId, start, end);
      expect(overlap).not.toBeNull();
      expect(overlap!.description).toBe('Conflict');
    });

    it('returns overlapping blocked time for partial overlap', async () => {
      const { start, end } = appointmentTimeRange(60, 60);
      await blockedTimeRepository.create(
        { description: 'Block', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
        userId,
      );

      const partialStart = new Date(start.getTime() - 30 * 60_000);
      const partialEnd = new Date(start.getTime() + 30 * 60_000);
      const overlap = await blockedTimeRepository.hasBlockedTimeOverlap(userId, partialStart, partialEnd);
      expect(overlap).not.toBeNull();
    });

    it('returns null when no overlap exists', async () => {
      const { start, end } = appointmentTimeRange(60, 60);
      await blockedTimeRepository.create(
        { description: 'Block', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
        userId,
      );

      const noOverlapStart = new Date(end.getTime() + 60 * 60_000);
      const noOverlapEnd = new Date(noOverlapStart.getTime() + 60 * 60_000);
      const overlap = await blockedTimeRepository.hasBlockedTimeOverlap(userId, noOverlapStart, noOverlapEnd);
      expect(overlap).toBeNull();
    });

    it('ignores soft-deleted blocked times', async () => {
      const { start, end } = appointmentTimeRange(60, 60);
      const created = await blockedTimeRepository.create(
        { description: 'Deleted', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
        userId,
      );
      await blockedTimeRepository.delete(created.id, userId);

      const overlap = await blockedTimeRepository.hasBlockedTimeOverlap(userId, start, end);
      expect(overlap).toBeNull();
    });

    it('ignores other users blocked times', async () => {
      const other = await createTestUser();
      const { start, end } = appointmentTimeRange(60, 60);
      await blockedTimeRepository.create(
        { description: 'Other', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
        other.id,
      );

      const overlap = await blockedTimeRepository.hasBlockedTimeOverlap(userId, start, end);
      expect(overlap).toBeNull();
    });

    it('returns the first overlapping blocked time when multiple exist', async () => {
      const { start, end } = appointmentTimeRange(60, 60);
      await blockedTimeRepository.create(
        { description: 'First', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() },
        userId,
      );
      const secondStart = new Date(start.getTime() + 15 * 60_000);
      const secondEnd = new Date(secondStart.getTime() + 60 * 60_000);
      await blockedTimeRepository.create(
        { description: 'Second', startTimeUtc: secondStart.toISOString(), endTimeUtc: secondEnd.toISOString() },
        userId,
      );

      const overlap = await blockedTimeRepository.hasBlockedTimeOverlap(userId, start, end);
      expect(overlap).not.toBeNull();
    });
  });
});
