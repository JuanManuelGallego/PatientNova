import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../../../src/utils/config/config.js';
import { AppointmentStatus, BookingRequestStatus } from '../../../generated/prisma/enums.js';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import { AppointmentHoldConflictError } from '../../../src/appointments/appointment.errors.js';
import { emailHash } from '../../../src/utils/encryption/blind-index.js';
import { createTestPatient } from '../helpers.js';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { bookingRequestRepository, type CreateBookingRequestData } from '../../../src/booking-requests/booking-request.repository.js';
import { issueRequestToken } from '../../../src/booking-requests/request-token.js';
import { publicBookingService } from '../../../src/public-booking/public-booking.service.js';
import { isAppointmentOverlapViolation } from '../../../src/utils/errors/prisma-errors.js';
import { PRIVACY_POLICY_VERSION } from '../../../src/portal/privacy-policy.js';
import { createLiveProvider, slotStarts, PORTAL_ZONE, type LiveProvider } from '../portal/portal-helpers.js';
import { DateTime } from 'luxon';

const portal = config.portal as { patientEnabled: boolean };
const portalWas = portal.patientEnabled;
beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = portalWas; });

const HOUR = 3_600_000;

function data(p: LiveProvider, start: Date, email = 'lucia@example.com'): CreateBookingRequestData {
  return {
    userId: p.id,
    email,
    name: 'Lucia',
    lastName: 'Rojas',
    typeId: p.typeId,
    locationId: p.locationId,
    startAt: start,
    endAt: new Date(start.getTime() + HOUR),
    patientTimezone: 'America/New_York',
    holdExpiresAt: new Date(Date.now() + 15 * 60_000),
    policyVersion: PRIVACY_POLICY_VERSION,
    consentAcceptedAt: new Date(),
  };
}

async function unconfirmed(p: LiveProvider, start: Date, email?: string) {
  const confirm = issueRequestToken();
  const release = issueRequestToken();
  const row = await prisma.$transaction((tx) => bookingRequestRepository.createUnconfirmed(
    { ...data(p, start, email), confirmTokenHash: confirm.hash, releaseTokenHash: release.hash },
    tx,
  ));
  return { row, confirm, release };
}

function pending(p: LiveProvider, start: Date) {
  return prisma.bookingRequest.create({
    data: { ...data(p, start), status: BookingRequestStatus.PENDING, confirmedAt: new Date(), holdExpiresAt: new Date(Date.now() + HOUR) },
  });
}

describe('UNCONFIRMED holds', () => {
  it('an UNCONFIRMED live hold blocks its slot in loadLiveHolds and in public slots', async () => {
    const p = await createLiveProvider();
    const starts = await slotStarts(p);
    const start = new Date(starts[ 0 ]!);
    const { row } = await unconfirmed(p, start);
    expect(row.status).toBe(BookingRequestStatus.UNCONFIRMED);
    expect(row.confirmedAt).toBeNull();

    const holds = await bookingRequestRepository.loadLiveHolds(p.id, start, new Date(start.getTime() + HOUR), 0, new Date());
    expect(holds).toHaveLength(1);

    const date = DateTime.fromJSDate(start).setZone(PORTAL_ZONE).toISODate()!;
    const { slots } = await publicBookingService.getSlots(p.slug, { typeId: p.typeId, from: date, to: date });
    expect(slots.map((s) => s.startUtc)).not.toContain(starts[ 0 ]);
  });

  it('the exclusion constraint rejects an UNCONFIRMED hold overlapping a PENDING one', async () => {
    const p = await createLiveProvider();
    const start = new Date((await slotStarts(p))[ 0 ]!);
    await unconfirmed(p, start);
    const err = await pending(p, new Date(start.getTime() + 30 * 60_000)).then(() => null, (e: unknown) => e);
    expect(isAppointmentOverlapViolation(err)).toBe(true);
  });

  it('provider inbox never lists UNCONFIRMED, nor EXPIRED/CANCELLED rows with confirmedAt null', async () => {
    const p = await createLiveProvider();
    const starts = await slotStarts(p);
    const live = (await unconfirmed(p, new Date(starts[ 0 ]!))).row;
    const expired = (await unconfirmed(p, new Date(starts[ 1 ]!))).row;
    const cancelled = (await unconfirmed(p, new Date(starts[ 2 ]!))).row;
    await prisma.bookingRequest.update({ where: { id: expired.id }, data: { status: BookingRequestStatus.EXPIRED, resolvedAt: new Date() } });
    await prisma.bookingRequest.update({ where: { id: cancelled.id }, data: { status: BookingRequestStatus.CANCELLED, resolvedAt: new Date() } });
    const confirmedPending = await pending(p, new Date(starts[ 3 ]!));

    const ids = [ live.id, expired.id, cancelled.id ];
    const now = new Date();
    const seen: string[] = [];
    for (const status of [ 'pending', 'expired', 'resolved' ] as const) {
      const { rows } = await bookingRequestRepository.listForProvider(p.id, { status, page: 1, pageSize: 50 }, now);
      seen.push(...rows.map((r) => r.id));
    }
    expect(seen.filter((id) => ids.includes(id))).toEqual([]);
    expect(seen).toContain(confirmedPending.id);
    expect(await bookingRequestRepository.countPending(p.id, now)).toBe(1);
    for (const id of ids) expect(await bookingRequestRepository.findForProvider(p.id, id)).toBeNull();
    expect(await bookingRequestRepository.findForProvider(p.id, confirmedPending.id)).not.toBeNull();
  });

  it('countLivePending counts PENDING; countLiveUnconfirmed and countLiveConfirmed narrow to a contact', async () => {
    const p = await createLiveProvider();
    const starts = await slotStarts(p);
    await unconfirmed(p, new Date(starts[ 0 ]!), 'ana@example.com');
    await unconfirmed(p, new Date(starts[ 2 ]!), 'otra@example.com');
    await pending(p, new Date(starts[ 1 ]!));
    const now = new Date();
    const ana = { emailHash: emailHash('ana@example.com')! };
    const lucia = { emailHash: emailHash('lucia@example.com')! };
    await prisma.$transaction(async (tx) => {
      expect(await bookingRequestRepository.countLivePending(p.id, now, tx)).toBe(1);
      expect(await bookingRequestRepository.countLiveUnconfirmed(p.id, now, tx)).toBe(2);
      expect(await bookingRequestRepository.countLiveUnconfirmed(p.id, now, tx, ana)).toBe(1);
      expect(await bookingRequestRepository.countLiveUnconfirmed(p.id, now, tx, lucia)).toBe(0);
      expect(await bookingRequestRepository.countLiveConfirmed(p.id, now, tx, lucia)).toBe(1);
      expect(await bookingRequestRepository.countLiveConfirmed(p.id, now, tx, ana)).toBe(0);
      expect(await bookingRequestRepository.countCreatedSince(p.id, new Date(now.getTime() - HOUR), tx, ana)).toBe(1);
      expect(await bookingRequestRepository.countCreatedSince(p.id, new Date(now.getTime() + 1000), tx, ana)).toBe(0);
    });
  });

  it('the provider creates an appointment over a live UNCONFIRMED hold; a confirmed PENDING one still blocks it', async () => {
    const p = await createLiveProvider();
    const starts = await slotStarts(p);
    await unconfirmed(p, new Date(starts[ 0 ]!));
    await pending(p, new Date(starts[ 1 ]!));
    const patient = await createTestPatient(p.id);
    const create = (start: string) => appointmentService.create({
      startAt: start, endAt: new Date(new Date(start).getTime() + HOUR).toISOString(), price: 0, paid: false,
      status: AppointmentStatus.SCHEDULED, patientId: patient.id, locationId: p.locationId, typeId: p.typeId,
    }, p.id);

    await expect(create(starts[ 0 ]!)).resolves.toMatchObject({ startAt: new Date(starts[ 0 ]!) });
    await expect(create(starts[ 1 ]!)).rejects.toBeInstanceOf(AppointmentHoldConflictError);
  });

  it('findByConfirmTokenHash and findByReleaseTokenHash find the row by hash only', async () => {
    const p = await createLiveProvider();
    const { row, confirm, release } = await unconfirmed(p, new Date((await slotStarts(p))[ 0 ]!));
    expect((await bookingRequestRepository.findByConfirmTokenHash(confirm.hash))?.id).toBe(row.id);
    expect(await bookingRequestRepository.findByConfirmTokenHash(release.hash)).toBeNull();
    expect(await bookingRequestRepository.findByConfirmTokenHash(confirm.token)).toBeNull();
    await prisma.$transaction(async (tx) => {
      expect((await bookingRequestRepository.findByReleaseTokenHash(release.hash, tx))?.id).toBe(row.id);
      expect(await bookingRequestRepository.findByReleaseTokenHash(confirm.hash, tx)).toBeNull();
    });
  });

  it('markConfirmationSent stamps confirmationSentAt and findStale reports both holding statuses', async () => {
    const p = await createLiveProvider();
    const { row } = await unconfirmed(p, new Date((await slotStarts(p))[ 0 ]!));
    const now = new Date();
    await bookingRequestRepository.markConfirmationSent(row.id, now);
    await prisma.bookingRequest.update({ where: { id: row.id }, data: { holdExpiresAt: new Date(now.getTime() - 1000) } });
    const stale = await prisma.$transaction((tx) => bookingRequestRepository.findStale(p.id, now, tx));
    expect(stale).toEqual([ expect.objectContaining({ id: row.id, status: 'UNCONFIRMED', confirmedAt: null, confirmationSentAt: now }) ]);
  });
});
