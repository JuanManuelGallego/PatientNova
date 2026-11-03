import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../../../src/utils/config/config.js';
import { ActionSource, BookingApprovalMode, BookingRequestStatus, EntityType } from '../../../generated/prisma/enums.js';
import { runInAuditContext } from '../../../src/audit-log/audit-log-context.js';
import { portalPatientAuditContext } from '../../../src/audit-log/audit-actors.js';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { bookingRequestService } from '../../../src/booking-requests/booking-request.service.js';
import { bookingRequestRepository } from '../../../src/booking-requests/booking-request.repository.js';
import { HOLD_HOURS } from '../../../src/booking-requests/booking-request.constants.js';
import { createWithin } from '../../../src/appointments/appointment.service.js';
import { AppointmentHoldConflictError } from '../../../src/appointments/appointment.errors.js';
import { isSlotFree, publicBookingService } from '../../../src/public-booking/public-booking.service.js';
import { bookingSettingsService } from '../../../src/booking-settings/booking-settings.service.js';
import { updateBookingSettingsSchema } from '../../../src/booking-settings/booking-settings.schemas.js';
import { withProviderLock } from '../../../src/utils/prisma/provider-lock.js';
import { isAppointmentOverlapViolation } from '../../../src/utils/errors/prisma-errors.js';
import { PRIVACY_POLICY_VERSION } from '../../../src/portal/privacy-policy.js';
import { createTestPatient } from '../helpers.js';
import { createLiveProvider, slotStarts, PORTAL_ZONE, type LiveProvider } from '../portal/portal-helpers.js';
import { DateTime } from 'luxon';

const portal = config.portal as { patientEnabled: boolean };
const portalWas = portal.patientEnabled;
beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = portalWas; });

const HOUR_MS = 3_600_000;
const DURATION_MIN = 60;

function settings() {
  return { timezone: PORTAL_ZONE, slotIntervalMinutes: 60, bufferMinutes: 0, minLeadMinutes: 0, maxHorizonDays: 30 };
}

function holdInput(p: LiveProvider, start: Date, email = 'lucia@example.com') {
  return {
    email,
    name: 'Lucia',
    lastName: 'Rojas',
    phone: '+573001112233',
    typeId: p.typeId,
    locationId: p.locationId,
    startAt: start,
    endAt: new Date(start.getTime() + DURATION_MIN * 60_000),
    patientTimezone: 'America/New_York',
    policyVersion: PRIVACY_POLICY_VERSION,
    consentAcceptedAt: new Date(),
    consentIp: '203.0.113.9',
    consentUserAgent: 'vitest',
  };
}

async function requestHold(p: LiveProvider, start: Date, email?: string) {
  return prisma.$transaction(async (tx) => {
    await withProviderLock(tx, p.id);
    const now = new Date();
    if (!(await isSlotFree(p.id, settings(), DURATION_MIN, start, now, { tx }))) throw new Error('slot taken');
    return bookingRequestService.createHoldWithin(tx, p.id, holdInput(p, start, email), now);
  });
}

async function firstStart(p: LiveProvider, daysAhead = 3, index = 0): Promise<Date> {
  const starts = await slotStarts(p, daysAhead);
  return new Date(starts[index]!);
}

async function providerAppointment(p: LiveProvider, start: Date, opts: { excludeRequestId?: string } = {}) {
  const patient = await createTestPatient(p.id);
  return prisma.$transaction((tx) => createWithin(tx, {
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + DURATION_MIN * 60_000).toISOString(),
    price: 100000,
    paid: false,
    status: 'SCHEDULED',
    patientId: patient.id,
    locationId: p.locationId,
    typeId: p.typeId,
  }, p.id, opts));
}

async function expireNow(requestId: string) {
  await prisma.bookingRequest.update({ where: { id: requestId }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
}

describe('booking request holds', () => {
  it('stores PII encrypted with a blind index and reads it back decrypted', async () => {
    const p = await createLiveProvider();
    const start = await firstStart(p);
    const request = await requestHold(p, start, 'Lucia@Example.com');

    const [ raw ] = await prisma.$queryRaw<{ email: string; name: string; lastName: string; phone: string; emailHash: string }[]>`
      SELECT "email", "name", "lastName", "phone", "emailHash" FROM booking_requests WHERE id = ${request.id}::uuid`;
    for (const value of [ raw!.email, raw!.name, raw!.lastName, raw!.phone ]) expect(value.startsWith('enc:')).toBe(true);
    expect(raw!.emailHash).toMatch(/^[0-9a-f]{64}$/);

    const read = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(read.email).toBe('Lucia@Example.com');
    expect(read.name).toBe('Lucia');
    expect(read.status).toBe(BookingRequestStatus.PENDING);
  });

  it('caps the hold at 48h and audits the creation without PII', async () => {
    const p = await createLiveProvider();
    const start = await firstStart(p, 10);
    const before = Date.now();
    const request = await requestHold(p, start);
    expect(request.holdExpiresAt.getTime() - before).toBeLessThanOrEqual(HOLD_HOURS * HOUR_MS + 5000);
    expect(request.holdExpiresAt.getTime() - before).toBeGreaterThan(HOLD_HOURS * HOUR_MS - 60_000);

    const audits = await prisma.auditLog.findMany({ where: { entityType: EntityType.BOOKING_REQUEST, entityId: request.id } });
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits[0]!.fieldsAfter)).not.toMatch(/lucia|rojas|example\.com|3001112233/i);
  });

  it('hides a held slot from the public slots and from the booking check; an expired hold frees it', async () => {
    const p = await createLiveProvider();
    const starts = await slotStarts(p);
    const held = starts[1]!;
    const request = await requestHold(p, new Date(held));

    expect(await slotStarts(p)).not.toContain(held);
    expect(await isSlotFree(p.id, settings(), DURATION_MIN, new Date(held), new Date())).toBe(false);
    expect(await isSlotFree(p.id, settings(), DURATION_MIN, new Date(held), new Date(), { excludeRequestId: request.id })).toBe(true);

    await expireNow(request.id);
    expect(await slotStarts(p)).toContain(held);
    expect(await isSlotFree(p.id, settings(), DURATION_MIN, new Date(held), new Date())).toBe(true);
  });

  it('does not let a cancelled or approved request hold a slot', async () => {
    const p = await createLiveProvider();
    const held = (await slotStarts(p))[2]!;
    const request = await requestHold(p, new Date(held));
    await prisma.bookingRequest.update({ where: { id: request.id }, data: { status: BookingRequestStatus.CANCELLED } });
    expect(await slotStarts(p)).toContain(held);
  });

  it('expands a hold by the buffer like an appointment', async () => {
    const p = await createLiveProvider({ bufferMinutes: 30 });
    const starts = await slotStarts(p);
    await prisma.user.update({ where: { id: p.id }, data: { slotIntervalMinutes: 60 } });
    await requestHold(p, new Date(starts[2]!));
    const after = await slotStarts(p);
    expect(after).not.toContain(starts[1]!);
    expect(after).not.toContain(starts[3]!);
  });

  it('keeps another provider\'s calendar unaffected', async () => {
    const a = await createLiveProvider();
    const b = await createLiveProvider();
    const startA = (await slotStarts(a))[0]!;
    await requestHold(a, new Date(startA));
    expect(await slotStarts(b)).toContain(startA);
  });
});

describe('provider-created appointments and holds', () => {
  it('rejects an appointment over a live hold with a neutral 409', async () => {
    const p = await createLiveProvider();
    const start = await firstStart(p);
    await requestHold(p, start);
    await expect(providerAppointment(p, start)).rejects.toBeInstanceOf(AppointmentHoldConflictError);
    expect(await prisma.appointment.count({ where: { userId: p.id } })).toBe(0);
  });

  it('allows the appointment that an approval creates for its own hold', async () => {
    const p = await createLiveProvider();
    const start = await firstStart(p);
    const request = await requestHold(p, start);
    const appointment = await providerAppointment(p, start, { excludeRequestId: request.id });
    expect(appointment.startAt).toEqual(start);
  });

  it('allows an appointment over an expired hold', async () => {
    const p = await createLiveProvider();
    const start = await firstStart(p);
    const request = await requestHold(p, start);
    await expireNow(request.id);
    await expect(providerAppointment(p, start)).resolves.toBeDefined();
  });

  it('lets exactly one of a hold and a concurrent appointment win the same slot', async () => {
    const p = await createLiveProvider();
    const start = await firstStart(p, 4);
    const results = await Promise.allSettled([ requestHold(p, start), providerAppointment(p, start) ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const [ holds, appointments ] = await Promise.all([
      prisma.bookingRequest.count({ where: { userId: p.id, status: BookingRequestStatus.PENDING } }),
      prisma.appointment.count({ where: { userId: p.id } }),
    ]);
    expect(holds + appointments).toBe(1);
  });

  it('lets exactly one of two concurrent holds on the same slot win', async () => {
    const p = await createLiveProvider();
    const start = await firstStart(p, 4);
    const results = await Promise.allSettled([ requestHold(p, start, 'a@example.com'), requestHold(p, start, 'b@example.com') ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.bookingRequest.count({ where: { userId: p.id } })).toBe(1);
  });
});

describe('hold overlap backstop and expiry', () => {
  it('rejects two live PENDING holds that overlap, mapped as an overlap violation', async () => {
    const p = await createLiveProvider();
    const start = await firstStart(p);
    await requestHold(p, start);
    const err = await prisma.$transaction(async (tx) => {
      await withProviderLock(tx, p.id);
      return bookingRequestRepository.create({ ...holdInput(p, start, 'x@example.com'), userId: p.id, holdExpiresAt: new Date(Date.now() + HOUR_MS) }, tx);
    }).then(() => null, (e: unknown) => e);
    expect(err).not.toBeNull();
    expect(isAppointmentOverlapViolation(err)).toBe(true);
  });

  it('allows back-to-back holds (half-open ranges)', async () => {
    const p = await createLiveProvider();
    const starts = await slotStarts(p);
    await requestHold(p, new Date(starts[0]!));
    await expect(requestHold(p, new Date(starts[1]!))).resolves.toBeDefined();
  });

  it('flips stale holds to EXPIRED with an audit row and lets the slot be held again', async () => {
    const p = await createLiveProvider();
    const start = await firstStart(p);
    const old = await requestHold(p, start);
    await expireNow(old.id);

    const fresh = await requestHold(p, start, 'otra@example.com');
    expect(fresh.id).not.toBe(old.id);

    const reloaded = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: old.id } });
    expect(reloaded.status).toBe(BookingRequestStatus.EXPIRED);
    expect(reloaded.resolvedAt).not.toBeNull();
    const audits = await prisma.auditLog.findMany({ where: { entityType: EntityType.BOOKING_REQUEST, entityId: old.id } });
    expect(audits.map((a) => a.description)).toContain('Solicitud de reserva vencida');
  });

  it('audits an expiry as the system, not as the patient whose booking swept it', async () => {
    const p = await createLiveProvider();
    const start = await firstStart(p);
    const old = await requestHold(p, start);
    await expireNow(old.id);

    const sweeper = portalPatientAuditContext({ userId: p.id, email: 'otra@example.com', ipAddress: '198.51.100.7' });
    await runInAuditContext(sweeper, () => requestHold(p, start, 'otra@example.com'));

    // `description` is encrypted at rest, so it cannot be used in `where`.
    const audits = await prisma.auditLog.findMany({ where: { entityType: EntityType.BOOKING_REQUEST, entityId: old.id } });
    const expiry = audits.find((a) => a.description === 'Solicitud de reserva vencida');
    expect(expiry).toMatchObject({ actorId: 'booking-request-expiry', source: ActionSource.JOB, ipAddress: null });
  });

  it('expireStaleWithin leaves live holds and other providers\' rows alone', async () => {
    const a = await createLiveProvider();
    const b = await createLiveProvider();
    const live = await requestHold(a, await firstStart(a));
    const otherStale = await requestHold(b, await firstStart(b));
    await expireNow(otherStale.id);

    const expired = await prisma.$transaction((tx) => bookingRequestService.expireStaleWithin(tx, a.id, new Date()));
    expect(expired).toEqual([]);
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: live.id } })).status).toBe(BookingRequestStatus.PENDING);
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: otherStale.id } })).status).toBe(BookingRequestStatus.PENDING);
  });

  it('serves the public slots without a round trip through the cron (expired rows stay PENDING until swept)', async () => {
    const p = await createLiveProvider();
    const date = DateTime.now().setZone(PORTAL_ZONE).plus({ days: 3 }).toISODate()!;
    const request = await requestHold(p, await firstStart(p));
    await expireNow(request.id);
    const { slots } = await publicBookingService.getSlots(p.slug, { typeId: p.typeId, from: date, to: date });
    expect(slots.map((s) => s.startUtc)).toContain((await slotStarts(p))[0]);
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe(BookingRequestStatus.PENDING);
  });
});

describe('bookingApprovalMode setting', () => {
  it('switches back to AUTO_CONFIRM, persists it and audits the change', async () => {
    const p = await createLiveProvider();
    await prisma.user.update({ where: { id: p.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });
    const result = await bookingSettingsService.updateSettings(p.id, { bookingApprovalMode: BookingApprovalMode.AUTO_CONFIRM });
    expect(result.bookingApprovalMode).toBe(BookingApprovalMode.AUTO_CONFIRM);
    expect((await bookingSettingsService.getSettings(p.id)).bookingApprovalMode).toBe(BookingApprovalMode.AUTO_CONFIRM);

    const audits = await prisma.auditLog.findMany({ where: { entityType: EntityType.USER, entityId: p.id } });
    expect(audits.some((a) => (a.affectedFields as string[]).includes('bookingApprovalMode'))).toBe(true);
  });

  it('the API schema accepts both modes and refuses an unknown one', () => {
    expect(updateBookingSettingsSchema.safeParse({ bookingApprovalMode: 'REQUIRE_APPROVAL' }).success).toBe(true);
    expect(updateBookingSettingsSchema.safeParse({ bookingApprovalMode: 'MAYBE' }).success).toBe(false);
    expect(updateBookingSettingsSchema.safeParse({ bookingApprovalMode: 'AUTO_CONFIRM' }).success).toBe(true);
  });
});
