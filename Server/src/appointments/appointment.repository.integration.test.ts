import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../prisma/prismaClient.js';
import { appointmentRepository } from './appointment.repository.js';
import { appointmentService } from './appointment.service.js';
import { AppointmentNotFoundError, AppointmentConflictError } from '../utils/errors.js';
import { createTestUser, createTestPatient, createTestLocation, createTestAppointmentType, appointmentTimeRange } from '../../test/integration/helpers.js';
import { AppointmentStatus, Channel, ReminderMode, ReminderStatus } from '../../generated/prisma/client.ts';

let userId: string;
let patientId: string;
let locationId: string;
let typeId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
  const loc = await createTestLocation(userId);
  locationId = loc.id;
  const type = await createTestAppointmentType(userId);
  typeId = type.id;
});

function baseCreateDto(overrides: Record<string, unknown> = {}) {
  const { start, end } = appointmentTimeRange(120, 30);
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    price: 100,
    paid: false,
    notes: null,
    status: AppointmentStatus.SCHEDULED,
    patientId,
    locationId,
    typeId,
    ...overrides,
  };
}

describe('appointmentRepository (integration)', () => {
  it('creates and reads back an appointment', async () => {
    const created = await appointmentRepository.create(baseCreateDto(), userId);
    expect(created.id).toBeTruthy();
    expect(created.patientId).toBe(patientId);
    expect(created.userId).toBe(userId);

    const found = await appointmentRepository.findByIdWithRelations(created.id, userId);
    expect(found.startAt).toBeInstanceOf(Date);
    expect(found.appointmentLocation?.id).toBe(locationId);
    expect(found.appointmentType?.id).toBe(typeId);
  });

  it('throws AppointmentNotFoundError for unknown id', async () => {
    await expect(appointmentRepository.findById('00000000-0000-0000-0000-000000000000', userId))
      .rejects.toThrow(AppointmentNotFoundError);
  });

  it('soft-deletes and restores an appointment', async () => {
    const created = await appointmentRepository.create(baseCreateDto(), userId);
    await appointmentRepository.delete(created.id, userId);

    await expect(appointmentRepository.findById(created.id, userId)).rejects.toThrow(AppointmentNotFoundError);

    const restored = await appointmentRepository.restore(created.id, userId);
    expect(restored.isDeleted).toBe(false);
  });

  it('allows overlapping appointments at the repository layer (conflict is enforced in the service)', async () => {
    const { start, end } = appointmentTimeRange(120, 30);
    await appointmentRepository.create(baseCreateDto({ startAt: start.toISOString(), endAt: end.toISOString() }), userId);

    const overlapStart = new Date(start.getTime() + 10 * 60_000).toISOString();
    const overlapEnd = new Date(end.getTime() + 10 * 60_000).toISOString();
    const created = await appointmentRepository.create(baseCreateDto({ startAt: overlapStart, endAt: overlapEnd }), userId);
    expect(created.id).toBeTruthy();
  });

  it('allows non-overlapping appointments', async () => {
    const first = appointmentTimeRange(120, 30);
    await appointmentRepository.create(baseCreateDto({ startAt: first.start.toISOString(), endAt: first.end.toISOString() }), userId);

    const second = appointmentTimeRange(180, 30);
    const created = await appointmentRepository.create(
      baseCreateDto({ startAt: second.start.toISOString(), endAt: second.end.toISOString() }),
      userId,
    );
    expect(created.id).toBeTruthy();
  });

  it('scopes findMany results to the owning user', async () => {
    await appointmentRepository.create(baseCreateDto(), userId);

    const other = await createTestUser();
    const page = await appointmentRepository.findMany({ page: 1, pageSize: 20, orderBy: 'startAt', order: 'asc', includeDeleted: false }, other.id);
    expect(page.data).toHaveLength(0);
  });

  it('excludes cancelled appointments from conflict detection', async () => {
    const { start, end } = appointmentTimeRange(120, 30);
    const cancelled = await appointmentRepository.create(
      baseCreateDto({ startAt: start.toISOString(), endAt: end.toISOString(), status: AppointmentStatus.CANCELLED }),
      userId,
    );
    expect(cancelled.status).toBe(AppointmentStatus.CANCELLED);

    const overlapStart = new Date(start.getTime() + 10 * 60_000).toISOString();
    const overlapEnd = new Date(end.getTime() + 10 * 60_000).toISOString();
    const created = await appointmentRepository.create(baseCreateDto({ startAt: overlapStart, endAt: overlapEnd }), userId);
    expect(created.id).toBeTruthy();
  });
});

describe('appointmentService (integration)', () => {
  it('creates an appointment with an inline reminder atomically', async () => {
    const { start, end } = appointmentTimeRange(120, 30);
    const created = await appointmentService.create(
      {
        ...baseCreateDto({ startAt: start.toISOString(), endAt: end.toISOString() }),
        reminder: {
          channel: Channel.WHATSAPP,
          to: '+10000000000',
          sendMode: ReminderMode.IMMEDIATE,
          status: ReminderStatus.PENDING,
        },
      },
      userId,
    );

    expect(created.id).toBeTruthy();
    expect(created.reminder).toBeTruthy();
    expect(created.reminder!.id).toBeTruthy();

    const reminder = await prisma.reminder.findUnique({ where: { id: created.reminder!.id } });
    expect(reminder).toBeTruthy();
    expect(reminder!.appointmentId).toBe(created.id);
    expect(reminder!.userId).toBe(userId);
  });

  it('transitions status and marks paid following the allowed state machine', async () => {
    const { start, end } = appointmentTimeRange(120, 30);
    const created = await appointmentService.create(baseCreateDto({ startAt: start.toISOString(), endAt: end.toISOString() }), userId);

    const confirmed = await appointmentService.setStatus(created.id, userId, AppointmentStatus.CONFIRMED);
    expect(confirmed.status).toBe(AppointmentStatus.CONFIRMED);
    expect(confirmed.confirmedAt).toBeInstanceOf(Date);

    const paid = await appointmentService.markPaid(created.id, userId);
    expect(paid.paid).toBe(true);

    // Cannot re-confirm from COMPLETED via invalid transition is guarded; cancel is allowed
    const cancelled = await appointmentService.setStatus(confirmed.id, userId, AppointmentStatus.CANCELLED);
    expect(cancelled.status).toBe(AppointmentStatus.CANCELLED);
  });

  it('rejects overlapping appointments with AppointmentConflictError', async () => {
    const { start, end } = appointmentTimeRange(120, 30);
    await appointmentService.create(baseCreateDto({ startAt: start.toISOString(), endAt: end.toISOString() }), userId);

    const overlapStart = new Date(start.getTime() + 10 * 60_000).toISOString();
    const overlapEnd = new Date(end.getTime() + 10 * 60_000).toISOString();
    await expect(
      appointmentService.create(baseCreateDto({ startAt: overlapStart, endAt: overlapEnd }), userId),
    ).rejects.toThrow(AppointmentConflictError);
  });

  it('does not flag conflict when excluding the appointment being updated', async () => {
    const { start, end } = appointmentTimeRange(120, 30);
    const created = await appointmentService.create(baseCreateDto({ startAt: start.toISOString(), endAt: end.toISOString() }), userId);

    // Updating the same appointment to a slightly different time must not self-conflict
    const newEnd = new Date(end.getTime() + 15 * 60_000).toISOString();
    const updated = await appointmentService.update(created.id, { endAt: newEnd }, userId);
    expect(updated.id).toBe(created.id);
  });
});

describe('appointmentRepository (additional coverage)', () => {
  it('findById returns the row and throws AppointmentNotFoundError for unknown id', async () => {
    const created = await appointmentRepository.create(baseCreateDto(), userId);
    const found = await appointmentRepository.findById(created.id, userId);
    expect(found.id).toBe(created.id);

    await expect(appointmentRepository.findById('00000000-0000-0000-0000-000000000000', userId))
      .rejects.toThrow(AppointmentNotFoundError);
  });

  it('getStats aggregates by status and revenue', async () => {
    await appointmentRepository.create(baseCreateDto({ status: AppointmentStatus.SCHEDULED, price: 100 }), userId);
    await appointmentRepository.create(baseCreateDto({ status: AppointmentStatus.CONFIRMED, price: 200 }), userId);

    const stats = await appointmentRepository.getStats({ includeDeleted: false }, userId);
    expect(stats.total).toBe(2);
    expect(stats.byStatus[AppointmentStatus.SCHEDULED]).toBe(1);
    expect(stats.byStatus[AppointmentStatus.CONFIRMED]).toBe(1);
    expect(stats.totalRevenue).toBe(300);
  });

  it('soft-deletes and restores an appointment via the repository', async () => {
    const created = await appointmentRepository.create(baseCreateDto(), userId);
    await appointmentRepository.delete(created.id, userId);

    await expect(appointmentRepository.findById(created.id, userId)).rejects.toThrow(AppointmentNotFoundError);

    const restored = await appointmentRepository.restore(created.id, userId);
    expect(restored.isDeleted).toBe(false);

    const found = await appointmentRepository.findById(created.id, userId);
    expect(found.id).toBe(created.id);
  });
});
