import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { patientRepository } from '../../../src/patients/patient.repository.js';
import { PatientNotFoundError } from '../../../src/utils/errors/errors.js';

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
      { page: 1, pageSize: 20, orderBy: 'createdAt', order: 'desc', includeDeleted: false, search: undefined },
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

  it('getStats aggregates patient counts by status', async () => {
    await patientRepository.create({ name: 'One', lastName: 'A', status: 'ACTIVE' }, userId);
    await patientRepository.create({ name: 'Two', lastName: 'B', status: 'INACTIVE' }, userId);
    await patientRepository.create({ name: 'Three', lastName: 'C', status: 'ACTIVE' }, userId);

    const stats = await patientRepository.getStats(userId);
    expect(stats.total).toBe(3);
    expect(stats.byStatus['ACTIVE']).toBe(2);
    expect(stats.byStatus['INACTIVE']).toBe(1);
  });

  it('findByIdWithRelations includes appointments, reminders and medical record', async () => {
    const patient = await patientRepository.create(
      { name: 'Rel', lastName: 'Patient', status: 'ACTIVE' },
      userId,
    );

    await prisma.appointment.create({
      data: {
        startAt: new Date(Date.now() + 60_000),
        endAt: new Date(Date.now() + 90_000),
        timezone: 'America/Bogota',
        price: 0,
        paid: false,
        status: 'SCHEDULED',
        patientId: patient.id,
        userId,
        locationId: (await prisma.appointmentLocation.create({ data: { name: 'Loc', userId } })).id,
        typeId: (await prisma.appointmentType.create({ data: { name: 'Type', defaultDuration: 60, userId } })).id,
      },
    });

    const found = await patientRepository.findByIdWithRelations(patient.id, userId);
    expect(found.appointments).toHaveLength(1);
    expect(found.reminders).toBeDefined();
    expect(found.medicalRecord).toBeNull();
  });

  it('findByIdWithRelations caps appointments via take and orders them by startAt desc', async () => {
    const patient = await patientRepository.create(
      { name: 'Cap', lastName: 'Patient', status: 'ACTIVE' },
      userId,
    );
    const location = await prisma.appointmentLocation.create({ data: { name: 'Loc', userId } });
    const type = await prisma.appointmentType.create({ data: { name: 'Type', defaultDuration: 60, userId } });

    const base = Date.now();
    for (let i = 0; i < 15; i++) {
      await prisma.appointment.create({
        data: {
          startAt: new Date(base + i * 60_000),
          endAt: new Date(base + i * 60_000 + 30_000),
          timezone: 'America/Bogota',
          price: 0,
          paid: false,
          status: 'SCHEDULED',
          patientId: patient.id,
          userId,
          locationId: location.id,
          typeId: type.id,
        },
      });
    }

    const capped = await patientRepository.findByIdWithRelations(patient.id, userId, { take: 3 });
    expect(capped.appointments).toHaveLength(3);
    for (let i = 1; i < capped.appointments.length; i++) {
      const prev = capped.appointments[i - 1];
      const curr = capped.appointments[i];
      expect(new Date(prev!.startAt).getTime()).toBeGreaterThanOrEqual(
        new Date(curr!.startAt).getTime(),
      );
    }
  });
});
