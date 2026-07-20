import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../prisma/prismaClient.js';
import { userRepository } from './user.repository.js';
import { createTestUser } from '../../test/integration/helpers.js';
import { UserEmailConflictError } from '../utils/errors.js';
import { AdminRole, AdminStatus } from '../../generated/prisma/client.ts';

beforeEach(async () => {
  await createTestUser();
});

describe('userRepository (integration)', () => {
  it('creates a user with a hashed password', async () => {
    const created = await userRepository.create({
      email: 'newuser@test.local',
      password: 'Password123!',
      role: AdminRole.VIEWER,
      status: AdminStatus.ACTIVE,
      firstName: 'New',
      lastName: 'User',
    });

    expect(created.id).toBeTruthy();
    expect(created.email).toBe('newuser@test.local');
    expect(created.role).toBe(AdminRole.VIEWER);

    const stored = await prisma.user.findUnique({ where: { id: created.id } });
    expect(stored!.passwordHash).not.toBe('Password123!');
    expect(stored!.passwordHash.startsWith('$2')).toBe(true);
  });

  it('rejects duplicate email with UserEmailConflictError', async () => {
    await userRepository.create({
      email: 'dup@test.local',
      password: 'Password123!',
      role: AdminRole.ADMIN,
      status: AdminStatus.ACTIVE,
      firstName: 'Dup',
      lastName: 'User',
    });

    await expect(
      userRepository.create({
        email: 'dup@test.local',
        password: 'Password123!',
        role: AdminRole.ADMIN,
        status: AdminStatus.ACTIVE,
        firstName: 'Dup',
        lastName: 'User',
      }),
    ).rejects.toThrow(UserEmailConflictError);
  });

  it('lists only non-deleted users by default', async () => {
    await userRepository.create({
      email: 'listed@test.local',
      password: 'Password123!',
      role: AdminRole.ADMIN,
      status: AdminStatus.ACTIVE,
      firstName: 'Listed',
      lastName: 'User',
    });

    const list = await userRepository.findMany();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.every((u) => u.id)).toBe(true);

    const deletedCount = await prisma.user.count({ where: { isDeleted: true } });
    expect(deletedCount).toBe(0);
  });

  it('soft-deletes and restores a user', async () => {
    const created = await userRepository.create({
      email: 'soft@test.local',
      password: 'Password123!',
      role: AdminRole.ADMIN,
      status: AdminStatus.ACTIVE,
      firstName: 'Soft',
      lastName: 'User',
    });

    await userRepository.delete(created.id);

    const raw = await prisma.user.findUnique({ where: { id: created.id } });
    expect(raw!.isDeleted).toBe(true);

    const listed = await userRepository.findMany();
    expect(listed.find((u) => u.id === created.id)).toBeUndefined();

    await userRepository.restore(created.id);
    const rawRestored = await prisma.user.findUnique({ where: { id: created.id } });
    expect(rawRestored!.isDeleted).toBe(false);
  });

  it('updates a user profile field', async () => {
    const created = await userRepository.create({
      email: 'update@test.local',
      password: 'Password123!',
      role: AdminRole.ADMIN,
      status: AdminStatus.ACTIVE,
      firstName: 'Update',
      lastName: 'User',
    });

    const updated = await userRepository.update(created.id, { firstName: 'Updated' });
    expect(updated.firstName).toBe('Updated');
  });
});
