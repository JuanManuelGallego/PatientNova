// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../prisma/prismaClient.js';
import { patientRepository } from './patient.repository.js';
import { PatientNotFoundError } from '../utils/errors.js';

// Integration test — runs against a real Postgres database.
// The DB is truncated before each test by test/integration/setup.ts.

let userId: string;

beforeEach(async () => {
  const user = await prisma.user.create({
    data: {
      email: `owner-${Date.now()}@test.local`,
      passwordHash: 'x',
    },
  });
  userId = user.id;
});

describe('patientRepository (integration)', () => {
  it('creates and reads back a patient', async () => {
    const created = await patientRepository.create(
      { name: 'Maria', lastName: 'Garcia', email: 'maria@test.local', status: 'ACTIVE' },
      userId,
    );

    expect(created.id).toBeTruthy();
    expect(created.email).toBe('maria@test.local');

    const found = await patientRepository.findById(created.id, userId);
    expect(found.name).toBe('Maria');
  });

  it('normalizes email to lowercase on create', async () => {
    const created = await patientRepository.create(
      { name: 'Ana', lastName: 'Lopez', email: 'ANA@TEST.LOCAL', status: 'ACTIVE' },
      userId,
    );
    expect(created.email).toBe('ana@test.local');
  });

  it('soft-deletes a patient and excludes it from findMany', async () => {
    const created = await patientRepository.create(
      { name: 'Luis', lastName: 'Ramirez', status: 'ACTIVE' },
      userId,
    );

    await patientRepository.delete(created.id, userId);

    const page = await patientRepository.findMany(
      { page: 1, pageSize: 20, orderBy: 'createdAt', order: 'desc', includeDeleted: false },
      userId,
    );
    expect(page.data).toHaveLength(0);

    const restored = await patientRepository.restore(created.id, userId);
    expect(restored.isDeleted).toBe(false);
  });

  it('throws PatientNotFoundError for another user\'s patient', async () => {
    const created = await patientRepository.create(
      { name: 'Sofia', lastName: 'Diaz', status: 'ACTIVE' },
      userId,
    );

    const other = await prisma.user.create({
      data: { email: `other-${Date.now()}@test.local`, passwordHash: 'x' },
    });

    await expect(patientRepository.findById(created.id, other.id)).rejects.toThrow(
      PatientNotFoundError,
    );
  });
});
