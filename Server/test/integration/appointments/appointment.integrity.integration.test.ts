import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import { appointmentRepository } from '../../../src/appointments/appointment.repository.js';
import { blockedTimeService } from '../../../src/blocked-time/blocked-time.service.js';
import { createAppointmentSchema } from '../../../src/appointments/appointment.schemas.js';
import {
  AppointmentBlockedTimeConflictError,
  AppointmentConflictError,
  AppointmentInvalidTimeRangeError,
  AppointmentNotFoundError,
  AppointmentStatusTransitionError,
} from '../../../src/appointments/appointment.errors.js';
import { AppointmentStatus } from '../../../generated/prisma/client.ts';
import { ActionType, EntityType } from '../../../generated/prisma/enums.ts';
import { createTestUser, createTestPatient, createTestLocation, createTestAppointmentType } from '../helpers.js';

const T0 = new Date('2031-05-05T14:00:00.000Z').getTime();
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

let userId: string;
let patientId: string;
let locationId: string;
let typeId: string;

beforeEach(async () => {
  userId = (await createTestUser()).id;
  patientId = (await createTestPatient(userId)).id;
  locationId = (await createTestLocation(userId)).id;
  typeId = (await createTestAppointmentType(userId)).id;
});

const dto = (startMin: number, endMin: number) => ({
  startAt: at(startMin).toISOString(),
  endAt: at(endMin).toISOString(),
  price: 100,
  paid: false,
  notes: null,
  status: AppointmentStatus.SCHEDULED,
  patientId,
  locationId,
  typeId,
});

describe('appointment status integrity (integration)', () => {
  it('rejects disallowed transitions through update (same table as setStatus)', async () => {
    const appt = await appointmentService.create(dto(0, 30), userId);
    await appointmentService.setStatus(appt.id, userId, AppointmentStatus.COMPLETED);
    // COMPLETED -> CANCELLED is not in the transition table
    await expect(
      appointmentService.update(appt.id, { status: AppointmentStatus.CANCELLED }, userId),
    ).rejects.toBeInstanceOf(AppointmentStatusTransitionError);
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(stored.status).toBe(AppointmentStatus.COMPLETED);
  });

  it('allows permitted transitions through update', async () => {
    const appt = await appointmentService.create(dto(0, 30), userId);
    const updated = await appointmentService.update(appt.id, { status: AppointmentStatus.CONFIRMED }, userId);
    expect(updated.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it('rejects a partial time update that would make end <= start', async () => {
    const appt = await appointmentService.create(dto(0, 30), userId);
    await expect(
      appointmentService.update(appt.id, { startAt: at(45).toISOString() }, userId),
    ).rejects.toBeInstanceOf(AppointmentInvalidTimeRangeError);
    await expect(
      appointmentService.update(appt.id, { endAt: at(-15).toISOString() }, userId),
    ).rejects.toBeInstanceOf(AppointmentInvalidTimeRangeError);
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(stored.startAt.toISOString()).toBe(at(0).toISOString());
    expect(stored.endAt.toISOString()).toBe(at(30).toISOString());
  });

  it('refuses to create COMPLETED, CANCELLED or NO_SHOW appointments', () => {
    const base = { ...dto(0, 30), startAt: new Date(Date.now() + 86_400_000).toISOString(), endAt: new Date(Date.now() + 90_000_000).toISOString() };
    for (const status of [ AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW ]) {
      expect(createAppointmentSchema.safeParse({ ...base, status }).success).toBe(false);
    }
    for (const status of [ AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED ]) {
      expect(createAppointmentSchema.safeParse({ ...base, status }).success).toBe(true);
    }
  });
});

describe('reactivation and restore re-check conflicts (integration)', () => {
  it('rejects setStatus reactivation into a slot that was taken meanwhile', async () => {
    const first = await appointmentService.create(dto(0, 30), userId);
    await appointmentService.setStatus(first.id, userId, AppointmentStatus.CANCELLED);
    await appointmentService.create(dto(0, 30), userId);
    await expect(
      appointmentService.setStatus(first.id, userId, AppointmentStatus.SCHEDULED),
    ).rejects.toBeInstanceOf(AppointmentConflictError);
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: first.id } });
    expect(stored.status).toBe(AppointmentStatus.CANCELLED);
  });

  it('rejects reactivation into blocked time', async () => {
    const first = await appointmentService.create(dto(0, 30), userId);
    await appointmentService.setStatus(first.id, userId, AppointmentStatus.CANCELLED);
    await blockedTimeService.create(
      { description: 'Block', startTimeUtc: at(0).toISOString(), endTimeUtc: at(60).toISOString() },
      userId,
    );
    await expect(
      appointmentService.setStatus(first.id, userId, AppointmentStatus.SCHEDULED),
    ).rejects.toBeInstanceOf(AppointmentBlockedTimeConflictError);
  });

  it('rejects restoring a deleted appointment into a taken slot, and restores when free', async () => {
    const first = await appointmentService.create(dto(0, 30), userId);
    await appointmentService.delete(first.id, userId);
    const second = await appointmentService.create(dto(0, 30), userId);

    await expect(appointmentService.restore(first.id, userId)).rejects.toBeInstanceOf(AppointmentConflictError);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: first.id } })).isDeleted).toBe(true);

    await appointmentService.delete(second.id, userId);
    const restored = await appointmentService.restore(first.id, userId);
    expect(restored.isDeleted).toBe(false);
  });

  it('restores a deleted CANCELLED appointment even when its old slot is taken (it is not active)', async () => {
    const first = await appointmentService.create(dto(0, 30), userId);
    await appointmentService.setStatus(first.id, userId, AppointmentStatus.CANCELLED);
    await appointmentService.delete(first.id, userId);
    await appointmentService.create(dto(0, 30), userId);
    const restored = await appointmentService.restore(first.id, userId);
    expect(restored.isDeleted).toBe(false);
  });
});

describe('status/paid/delete/restore write their audit row in the same transaction', () => {
  const auditFor = (entityId: string, actionType: ActionType) =>
    prisma.auditLog.findMany({ where: { entityType: EntityType.APPOINTMENT, entityId, actionType } });

  it('records one audit row per operation', async () => {
    const appt = await appointmentService.create(dto(0, 30), userId);
    await appointmentService.setStatus(appt.id, userId, AppointmentStatus.CONFIRMED);
    await appointmentService.markPaid(appt.id, userId);
    await appointmentService.delete(appt.id, userId);
    await appointmentService.restore(appt.id, userId);

    expect(await auditFor(appt.id, ActionType.CREATE)).toHaveLength(1);
    // setStatus + markPaid
    expect(await auditFor(appt.id, ActionType.UPDATE)).toHaveLength(2);
    expect(await auditFor(appt.id, ActionType.DELETE)).toHaveLength(1);
    expect(await auditFor(appt.id, ActionType.RESTORE)).toHaveLength(1);
  });

  it('writes no audit row and changes nothing when a status change is rejected', async () => {
    const appt = await appointmentService.create(dto(0, 30), userId);
    await appointmentService.setStatus(appt.id, userId, AppointmentStatus.COMPLETED);
    const before = await auditFor(appt.id, ActionType.UPDATE);
    await expect(
      appointmentService.setStatus(appt.id, userId, AppointmentStatus.CANCELLED),
    ).rejects.toBeInstanceOf(AppointmentStatusTransitionError);
    expect(await auditFor(appt.id, ActionType.UPDATE)).toHaveLength(before.length);
  });
});

describe('appointmentRepository.update is tenant-scoped', () => {
  it('cannot update another provider\'s appointment even with a valid id', async () => {
    const appt = await appointmentService.create(dto(0, 30), userId);
    const other = await createTestUser();
    await expect(
      appointmentRepository.update(appt.id, { paid: true }, other.id),
    ).rejects.toBeTruthy();
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).paid).toBe(false);
  });

  it('service operations on another provider\'s appointment behave as not found', async () => {
    const appt = await appointmentService.create(dto(0, 30), userId);
    const other = await createTestUser();
    await expect(appointmentService.setStatus(appt.id, other.id, AppointmentStatus.CONFIRMED))
      .rejects.toBeInstanceOf(AppointmentNotFoundError);
    await expect(appointmentService.markPaid(appt.id, other.id)).rejects.toBeInstanceOf(AppointmentNotFoundError);
    await expect(appointmentService.delete(appt.id, other.id)).rejects.toBeInstanceOf(AppointmentNotFoundError);
  });
});
