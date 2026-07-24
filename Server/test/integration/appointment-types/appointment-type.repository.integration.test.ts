import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { appointmentTypeRepository } from '../../../src/appointment-types/appointment-type.repository.js';
import { createTestUser } from '../helpers.js';
import { AppointmentTypeNameConflictError } from '../../../src/appointment-types/appointment-type.errors.js';

let userId: string;

beforeEach(async () => {
  const u = await createTestUser();
  userId = u.id;
});

describe('appointmentTypeRepository (integration)', () => {
  it('creates and reads back an appointment type', async () => {
    const created = await appointmentTypeRepository.create({ name: 'Consulta', defaultDuration: 60 }, userId);
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Consulta');
    expect(created.userId).toBe(userId);

    const found = await appointmentTypeRepository.findById(created.id, userId);
    expect(found.id).toBe(created.id);
  });

  it('rejects duplicate names per user with AppointmentTypeNameConflictError', async () => {
    await appointmentTypeRepository.create({ name: 'Dup Type', defaultDuration: 60 }, userId);
    await expect(appointmentTypeRepository.create({ name: 'Dup Type', defaultDuration: 60 }, userId))
      .rejects.toThrow(AppointmentTypeNameConflictError);
  });

  it('allows same name for different users', async () => {
    await appointmentTypeRepository.create({ name: 'Shared Type', defaultDuration: 60 }, userId);
    const other = await createTestUser();
    const created = await appointmentTypeRepository.create({ name: 'Shared Type', defaultDuration: 60 }, other.id);
    expect(created.id).toBeTruthy();
  });

  it('lists only non-deleted types by default', async () => {
    await appointmentTypeRepository.create({ name: 'Listed Type', defaultDuration: 60 }, userId);
    const list = await appointmentTypeRepository.findMany(userId);
    expect(list.every((t) => !t.isDeleted)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('soft-deletes and restores an appointment type', async () => {
    const created = await appointmentTypeRepository.create({ name: 'Soft Type', defaultDuration: 60 }, userId);
    await appointmentTypeRepository.delete(created.id, userId);
    const raw = await prisma.appointmentType.findUnique({ where: { id: created.id } });
    expect(raw!.isDeleted).toBe(true);

    await appointmentTypeRepository.restore(created.id, userId);
    const rawRestored = await prisma.appointmentType.findUnique({ where: { id: created.id } });
    expect(rawRestored!.isDeleted).toBe(false);
  });
});
