import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../prisma/prismaClient.js';
import { locationRepository } from './location.repository.js';
import { createTestUser } from '../../test/integration/helpers.js';
import { LocationNameConflictError } from '../utils/errors.js';

let userId: string;

beforeEach(async () => {
  const u = await createTestUser();
  userId = u.id;
});

describe('locationRepository (integration)', () => {
  it('creates and reads back a location', async () => {
    const created = await locationRepository.create({ name: 'Main Office', isVirtual: false }, userId);
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Main Office');
    expect(created.userId).toBe(userId);

    const found = await locationRepository.findById(created.id, userId);
    expect(found.id).toBe(created.id);
  });

  it('rejects duplicate names per user with LocationNameConflictError', async () => {
    await locationRepository.create({ name: 'Dup Office', isVirtual: false }, userId);
    await expect(locationRepository.create({ name: 'Dup Office', isVirtual: true }, userId))
      .rejects.toThrow(LocationNameConflictError);
  });

  it('allows same name for different users', async () => {
    await locationRepository.create({ name: 'Shared Office', isVirtual: false }, userId);
    const other = await createTestUser();
    const created = await locationRepository.create({ name: 'Shared Office', isVirtual: false }, other.id);
    expect(created.id).toBeTruthy();
  });

  it('lists only non-deleted locations by default', async () => {
    await locationRepository.create({ name: 'Listed Office', isVirtual: false }, userId);
    const list = await locationRepository.findMany(userId);
    expect(list.every((l) => !l.isDeleted)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('soft-deletes and restores a location', async () => {
    const created = await locationRepository.create({ name: 'Soft Office', isVirtual: false }, userId);
    await locationRepository.delete(created.id, userId);
    const raw = await prisma.appointmentLocation.findUnique({ where: { id: created.id } });
    expect(raw!.isDeleted).toBe(true);

    await locationRepository.restore(created.id, userId);
    const rawRestored = await prisma.appointmentLocation.findUnique({ where: { id: created.id } });
    expect(rawRestored!.isDeleted).toBe(false);
  });
});
