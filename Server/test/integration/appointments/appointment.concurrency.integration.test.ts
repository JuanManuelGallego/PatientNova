import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import { blockedTimeService } from '../../../src/blocked-time/blocked-time.service.js';
import {
  AppointmentBlockedTimeConflictError,
  AppointmentConflictError,
} from '../../../src/appointments/appointment.errors.js';
import { BlockedTimeOverlapError } from '../../../src/blocked-time/blocked-time.errors.js';
import { isAppointmentOverlapViolation } from '../../../src/utils/errors/prisma-errors.js';
import { AppointmentStatus } from '../../../generated/prisma/client.ts';
import { createTestUser, createTestPatient, createTestLocation, createTestAppointmentType } from '../helpers.js';

// Fixed far-future slot so tests never depend on "now".
const T0 = new Date('2031-03-03T14:00:00.000Z').getTime();
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

interface Provider { userId: string; patientIds: string[]; locationId: string; typeId: string }

async function makeProvider(patients = 2): Promise<Provider> {
  const user = await createTestUser();
  const patientIds: string[] = [];
  for (let i = 0; i < patients; i++) patientIds.push((await createTestPatient(user.id)).id);
  const loc = await createTestLocation(user.id);
  const type = await createTestAppointmentType(user.id);
  return { userId: user.id, patientIds, locationId: loc.id, typeId: type.id };
}

function dto(p: Provider, patientIdx: number, startMin: number, endMin: number) {
  return {
    startAt: at(startMin).toISOString(),
    endAt: at(endMin).toISOString(),
    price: 100,
    paid: false,
    notes: null,
    status: AppointmentStatus.SCHEDULED,
    patientId: p.patientIds[patientIdx]!,
    locationId: p.locationId,
    typeId: p.typeId,
  };
}

const activeCount = (userId: string) =>
  prisma.appointment.count({ where: { userId, isDeleted: false, status: { in: ['SCHEDULED', 'CONFIRMED'] } } });

let p: Provider;
beforeEach(async () => { p = await makeProvider(); });

describe('provider calendar integrity (integration)', () => {
  it('lets exactly one of several concurrent creates for the same slot win', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => appointmentService.create(dto(p, 0, 0, 30), p.userId)),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(5);
    for (const f of failed) expect(f.reason).toBeInstanceOf(AppointmentConflictError);
    expect(await activeCount(p.userId)).toBe(1);
  });

  it('blocks overlapping appointments for DIFFERENT patients of the same provider', async () => {
    const results = await Promise.allSettled([
      appointmentService.create(dto(p, 0, 0, 60), p.userId),
      appointmentService.create(dto(p, 1, 30, 90), p.userId),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await activeCount(p.userId)).toBe(1);
  });

  it('allows back-to-back appointments (half-open intervals)', async () => {
    await appointmentService.create(dto(p, 0, 0, 30), p.userId);
    await appointmentService.create(dto(p, 1, 30, 60), p.userId);
    expect(await activeCount(p.userId)).toBe(2);
  });

  it('does not let one provider block another', async () => {
    const other = await makeProvider(1);
    await Promise.all([
      appointmentService.create(dto(p, 0, 0, 30), p.userId),
      appointmentService.create(dto(other, 0, 0, 30), other.userId),
    ]);
    expect(await activeCount(p.userId)).toBe(1);
    expect(await activeCount(other.userId)).toBe(1);
  });

  it('ignores cancelled appointments when checking conflicts', async () => {
    const first = await appointmentService.create(dto(p, 0, 0, 30), p.userId);
    await appointmentService.setStatus(first.id, p.userId, AppointmentStatus.CANCELLED);
    await appointmentService.create(dto(p, 1, 0, 30), p.userId);
    expect(await activeCount(p.userId)).toBe(1);
  });

  it('rejects moving an appointment onto an occupied slot, and races of two moves have one winner', async () => {
    await appointmentService.create(dto(p, 0, 0, 30), p.userId);
    const b = await appointmentService.create(dto(p, 1, 60, 90), p.userId);
    await expect(
      appointmentService.update(b.id, { startAt: at(10).toISOString(), endAt: at(40).toISOString() }, p.userId),
    ).rejects.toBeInstanceOf(AppointmentConflictError);

    const c = await appointmentService.create(dto(p, 0, 120, 150), p.userId);
    const results = await Promise.allSettled([
      appointmentService.update(b.id, { startAt: at(200).toISOString(), endAt: at(230).toISOString() }, p.userId),
      appointmentService.update(c.id, { startAt: at(210).toISOString(), endAt: at(240).toISOString() }, p.userId),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('rejects reactivating a cancelled appointment into a taken slot', async () => {
    const first = await appointmentService.create(dto(p, 0, 0, 30), p.userId);
    await appointmentService.setStatus(first.id, p.userId, AppointmentStatus.CANCELLED);
    await appointmentService.create(dto(p, 1, 0, 30), p.userId);
    await expect(
      appointmentService.update(first.id, { status: AppointmentStatus.SCHEDULED }, p.userId),
    ).rejects.toBeInstanceOf(AppointmentConflictError);
  });

  it('serializes overlapping blocked-time creates', async () => {
    const mk = () => blockedTimeService.create(
      { description: 'Block', startTimeUtc: at(0).toISOString(), endTimeUtc: at(60).toISOString() },
      p.userId,
    );
    const results = await Promise.allSettled([mk(), mk(), mk()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of results) {
      if (r.status === 'rejected') expect(r.reason).toBeInstanceOf(BlockedTimeOverlapError);
    }
  });

  it('keeps an appointment-vs-blocked-time race consistent with some serial order', async () => {
    const results = await Promise.allSettled([
      appointmentService.create(dto(p, 0, 0, 30), p.userId),
      blockedTimeService.create(
        { description: 'Block', startTimeUtc: at(0).toISOString(), endTimeUtc: at(60).toISOString() },
        p.userId,
      ),
    ]);
    const [appt, block] = results;
    expect(block!.status).toBe('fulfilled'); // blocked time may be placed over an existing appointment
    if (appt!.status === 'rejected') {
      // The block won the lock first, so the appointment must be rejected for that reason only.
      expect(appt!.reason).toBeInstanceOf(AppointmentBlockedTimeConflictError);
    }
    // Whatever happened, a later attempt inside the blocked window is always rejected.
    await expect(appointmentService.create(dto(p, 1, 10, 20), p.userId)).rejects.toBeTruthy();
  });
});

describe('appointments_no_provider_overlap constraint (DB backstop)', () => {
  const raw = (
    pr: Provider,
    patientIdx: number,
    startMin: number,
    endMin: number,
    extra: Record<string, unknown> = {},
  ) =>
    prisma.appointment.create({
      data: {
        userId: pr.userId,
        patientId: pr.patientIds[patientIdx]!,
        locationId: pr.locationId,
        typeId: pr.typeId,
        price: 1,
        startAt: at(startMin),
        endAt: at(endMin),
        ...extra,
      },
    });

  it('rejects an overlapping insert that bypasses the service, with a recognizable error', async () => {
    await raw(p, 0, 0, 60);
    const err = await raw(p, 1, 30, 90).catch((e: unknown) => e);
    expect(isAppointmentOverlapViolation(err)).toBe(true);
  });

  it('ignores deleted and non-active appointments, and allows adjacency', async () => {
    await raw(p, 0, 0, 60, { isDeleted: true });
    await raw(p, 0, 0, 60, { status: AppointmentStatus.CANCELLED });
    await raw(p, 0, 0, 60);
    await raw(p, 1, 60, 90);
    expect(await activeCount(p.userId)).toBe(2);
  });

  it('does not misclassify unrelated errors', () => {
    expect(isAppointmentOverlapViolation(new Error('boom'))).toBe(false);
    expect(isAppointmentOverlapViolation({ meta: { driverAdapterError: { cause: { originalCode: '23505' } } } })).toBe(false);
    expect(isAppointmentOverlapViolation(null)).toBe(false);
  });
});
