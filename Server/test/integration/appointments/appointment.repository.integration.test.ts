import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { appointmentRepository } from '../../../src/appointments/appointment.repository.js';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import { AppointmentNotFoundError, AppointmentConflictError } from '../../../src/appointments/appointment.errors.js';
import { createTestUser, createTestPatient, createTestLocation, createTestAppointmentType, appointmentTimeRange } from '../helpers.js';
import { AppointmentStatus, Channel, ReminderMode, ReminderStatus } from '../../../generated/prisma/client.ts';
import { AppointmentBlockedTimeConflictError } from '../../../src/appointments/appointment.errors.js';

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

  it('combines status + paid filters without the status filter being dropped', async () => {
    await appointmentRepository.create(baseCreateDto({ status: AppointmentStatus.SCHEDULED, paid: true }), userId);
    await appointmentRepository.create(baseCreateDto({ status: AppointmentStatus.SCHEDULED, paid: false }), userId);
    await appointmentRepository.create(baseCreateDto({ status: AppointmentStatus.CANCELLED, paid: true }), userId);

    const page = await appointmentRepository.findMany(
      { page: 1, pageSize: 20, status: [AppointmentStatus.SCHEDULED], paid: true, orderBy: 'startAt', order: 'asc', includeDeleted: false },
      userId,
    );

    expect(page.data).toHaveLength(1);
    expect(page.data[0]!.status).toBe(AppointmentStatus.SCHEDULED);
    expect(page.data[0]!.paid).toBe(true);
  });

  it('excludes CANCELLED appointments when filtering by paid status', async () => {
    await appointmentRepository.create(baseCreateDto({ status: AppointmentStatus.SCHEDULED, paid: true }), userId);
    await appointmentRepository.create(baseCreateDto({ status: AppointmentStatus.CANCELLED, paid: true }), userId);
    await appointmentRepository.create(baseCreateDto({ status: AppointmentStatus.SCHEDULED, paid: false }), userId);
    await appointmentRepository.create(baseCreateDto({ status: AppointmentStatus.CANCELLED, paid: false }), userId);

    const paidPage = await appointmentRepository.findMany(
      { page: 1, pageSize: 20, paid: true, orderBy: 'startAt', order: 'asc', includeDeleted: false },
      userId,
    );
    expect(paidPage.data).toHaveLength(1);
    expect(paidPage.data[0]!.status).toBe(AppointmentStatus.SCHEDULED);
    expect(paidPage.data[0]!.paid).toBe(true);

    const unpaidPage = await appointmentRepository.findMany(
      { page: 1, pageSize: 20, paid: false, orderBy: 'startAt', order: 'asc', includeDeleted: false },
      userId,
    );
    expect(unpaidPage.data).toHaveLength(1);
    expect(unpaidPage.data[0]!.status).toBe(AppointmentStatus.SCHEDULED);
    expect(unpaidPage.data[0]!.paid).toBe(false);
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
    expect(cancelled.paid).toBe(false);
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

  it('rejects appointment creation that overlaps a blocked time slot', async () => {
    const { start, end } = appointmentTimeRange(120, 30);

    await prisma.blockedTime.create({
      data: {
        userId,
        description: 'Lunch break',
        startTimeUtc: start,
        endTimeUtc: end,
      },
    });

    await expect(
      appointmentService.create(baseCreateDto({ startAt: start.toISOString(), endAt: end.toISOString() }), userId),
    ).rejects.toThrow(AppointmentBlockedTimeConflictError);
  });

  it('rejects appointment creation when blocked time is partially contained', async () => {
    const blockStart = new Date(Date.now() + 120 * 60_000);
    const blockEnd = new Date(blockStart.getTime() + 60 * 60_000);

    await prisma.blockedTime.create({
      data: { userId, description: 'Meeting', startTimeUtc: blockStart, endTimeUtc: blockEnd },
    });

    // Appointment starts 30 min before the block and ends 30 min into it
    const apptStart = new Date(blockStart.getTime() - 30 * 60_000);
    const apptEnd = new Date(blockStart.getTime() + 30 * 60_000);

    await expect(
      appointmentService.create(baseCreateDto({ startAt: apptStart.toISOString(), endAt: apptEnd.toISOString() }), userId),
    ).rejects.toThrow(AppointmentBlockedTimeConflictError);
  });

  it('allows appointment creation when blocked time does not overlap', async () => {
    const blockStart = new Date(Date.now() + 120 * 60_000);
    const blockEnd = new Date(blockStart.getTime() + 30 * 60_000);

    await prisma.blockedTime.create({
      data: { userId, description: 'Lunch', startTimeUtc: blockStart, endTimeUtc: blockEnd },
    });

    // Appointment starts after the block ends
    const apptStart = new Date(blockEnd.getTime() + 10 * 60_000);
    const apptEnd = new Date(apptStart.getTime() + 30 * 60_000);

    const created = await appointmentService.create(
      baseCreateDto({ startAt: apptStart.toISOString(), endAt: apptEnd.toISOString() }),
      userId,
    );
    expect(created.id).toBeTruthy();
  });

  it('ignores deleted blocked time slots for overlap check', async () => {
    const { start, end } = appointmentTimeRange(120, 30);

    await prisma.blockedTime.create({
      data: {
        userId,
        description: 'Old break',
        startTimeUtc: start,
        endTimeUtc: end,
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    const created = await appointmentService.create(
      baseCreateDto({ startAt: start.toISOString(), endAt: end.toISOString() }),
      userId,
    );
    expect(created.id).toBeTruthy();
  });

  it('rejects appointment update that moves into a blocked time slot', async () => {
    const { start, end } = appointmentTimeRange(120, 30);
    const created = await appointmentService.create(baseCreateDto({ startAt: start.toISOString(), endAt: end.toISOString() }), userId);

    // Create a blocked time slot in the future
    const blockStart = new Date(Date.now() + 300 * 60_000);
    const blockEnd = new Date(blockStart.getTime() + 60 * 60_000);
    await prisma.blockedTime.create({
      data: { userId, description: 'Vacation', startTimeUtc: blockStart, endTimeUtc: blockEnd },
    });

    await expect(
      appointmentService.update(created.id, { startAt: blockStart.toISOString(), endAt: blockEnd.toISOString() }, userId),
    ).rejects.toThrow(AppointmentBlockedTimeConflictError);
  });

  it('allows appointment update when time change does not overlap blocked time', async () => {
    const { start, end } = appointmentTimeRange(120, 30);
    const created = await appointmentService.create(baseCreateDto({ startAt: start.toISOString(), endAt: end.toISOString() }), userId);

    // Blocked time far in the future — no overlap with the appointment
    const blockStart = new Date(Date.now() + 600 * 60_000);
    const blockEnd = new Date(blockStart.getTime() + 30 * 60_000);
    await prisma.blockedTime.create({
      data: { userId, description: 'Workshop', startTimeUtc: blockStart, endTimeUtc: blockEnd },
    });

    // Update only the price (no time change) — should not trigger blocked time check
    const updated = await appointmentService.update(created.id, { price: 999 }, userId);
    expect(updated.price).toBe(999);
  });

  it('ignores other users blocked time slots', async () => {
    const otherUser = await createTestUser();
    const { start, end } = appointmentTimeRange(120, 30);

    // Create blocked time for a different user
    await prisma.blockedTime.create({
      data: { userId: otherUser.id, description: 'Other break', startTimeUtc: start, endTimeUtc: end },
    });

    // Current user should be able to create an overlapping appointment
    const created = await appointmentService.create(
      baseCreateDto({ startAt: start.toISOString(), endAt: end.toISOString() }),
      userId,
    );
    expect(created.id).toBeTruthy();
  });
});
