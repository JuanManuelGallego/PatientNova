import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), send: vi.fn() }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: () => ({ send: mocks.send }) }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { logger } from '../../../src/utils/api/logger.js';
import { bookingRequestService } from '../../../src/booking-requests/booking-request.service.js';
import { deliverBookingRequestNotification, type BookingRequestEvent } from '../../../src/booking-requests/booking-request-notifications.js';
import { ActionType, BookingRequestKind, BookingRequestStatus, Channel, EntityType } from '../../../generated/prisma/enums.js';
import { hashRequestToken } from '../../../src/booking-requests/request-token.js';
import { bookingStartService } from '../../../src/portal/booking-start.service.js';
import { createLiveProvider, createPendingRequestWithin, slotStarts, type LiveProvider } from './portal-helpers.js';
import { withProviderLock } from '../../../src/utils/prisma/provider-lock.js';

const portal = config.portal as { patientEnabled: boolean };
const portalWas = portal.patientEnabled;
const scheduler = config.scheduler as { enabled: boolean };
const schedulerWas = scheduler.enabled;
beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = portalWas; scheduler.enabled = schedulerWas; });
beforeEach(() => {
  scheduler.enabled = true;
  mocks.dispatch.mockReset().mockResolvedValue({ success: true, messageSid: 'msg-1' });
  mocks.send.mockReset().mockResolvedValue('job-1');
});

let seq = 0;
const tokenPair = () => ({
  confirmTokenHash: hashRequestToken(`c${++seq}-${Date.now()}`),
  releaseTokenHash: hashRequestToken(`r${seq}-${Date.now()}`),
});

interface RowOpts {
  channel?: Channel;
  slotIndex?: number;
  sent?: boolean;
  stale?: boolean;
}

async function unconfirmed(p: LiveProvider, opts: RowOpts = {}) {
  const channel = opts.channel ?? Channel.EMAIL;
  const start = new Date((await slotStarts(p, 3))[opts.slotIndex ?? 0]!);
  const row = await prisma.$transaction(async (tx) => (await bookingRequestService.createUnconfirmedWithin(tx, p.id, {
    kind: BookingRequestKind.NEW,
    contactChannel: channel,
    email: channel === Channel.EMAIL ? `p${++seq}@example.com` : null,
    verifiedPhone: channel === Channel.WHATSAPP ? `+57300${String(1000000 + ++seq)}` : null,
    name: 'Lucia',
    lastName: 'Rojas',
    phone: null,
    typeId: p.typeId,
    locationId: p.locationId,
    startAt: start,
    endAt: new Date(start.getTime() + 3_600_000),
    patientTimezone: 'America/Bogota',
    policyVersion: '2026-11-06',
    consentAcceptedAt: new Date(),
    consentIp: null,
    consentUserAgent: null,
    ...tokenPair(),
  }, new Date())).request);
  return prisma.bookingRequest.update({
    where: { id: row.id },
    data: {
      ...(opts.sent !== false && { confirmationSentAt: new Date() }),
      ...(opts.stale !== false && { holdExpiresAt: new Date(Date.now() - 60_000) }),
    },
  });
}

const sentJobs = (event: string) => mocks.send.mock.calls
  .map((c) => c[1] as { requestId: string; event: string })
  .filter((j) => j.event === event);

async function sweepAndDeliver(event: string) {
  const result = await bookingRequestService.sweep();
  for (const job of sentJobs(event)) {
    await deliverBookingRequestNotification({ requestId: job.requestId, event: job.event as BookingRequestEvent });
  }
  return result;
}

const expiryAudit = (id: string) => prisma.auditLog.findFirstOrThrow({
  where: { entityType: EntityType.BOOKING_REQUEST, entityId: id, actionType: ActionType.UPDATE },
});

describe('unconfirmed hold expiry', () => {
  it('the sweep expires an unconfirmed hold and sends unconfirmed-expired by email', async () => {
    const p = await createLiveProvider();
    const row = await unconfirmed(p);
    const address = row.email;

    await sweepAndDeliver('unconfirmed-expired');

    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(BookingRequestStatus.EXPIRED);
    expect(sentJobs('expired')).toHaveLength(0);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    const [ channel, opts ] = mocks.dispatch.mock.calls[0]!;
    expect(channel).toBe(Channel.EMAIL);
    expect(opts.to).toBe(address);
  });

  it('audits the real previous status', async () => {
    const p = await createLiveProvider();
    const row = await unconfirmed(p);
    await bookingRequestService.sweep();
    const audit = await expiryAudit(row.id);
    expect(JSON.stringify(audit.fieldsBefore)).toContain('UNCONFIRMED');
    expect(JSON.stringify(audit.fieldsBefore)).not.toContain('PENDING');
  });

  it('by WhatsApp it uses the unconfirmed-expired template, not request-expired', async () => {
    const p = await createLiveProvider();
    await unconfirmed(p, { channel: Channel.WHATSAPP });

    await sweepAndDeliver('unconfirmed-expired');

    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    const [ channel, opts ] = mocks.dispatch.mock.calls[0]!;
    expect(channel).toBe(Channel.WHATSAPP);
    expect(opts.contentSid).toBe(config.twilio.patientPortal.unconfirmedExpiredSid);
    expect(opts.contentSid).not.toBe(config.twilio.patientPortal.requestExpiredSid);
  });

  it('without the unconfirmed-expired template the WhatsApp notice is skipped with an info log and no PII', async () => {
    const p = await createLiveProvider();
    const row = await unconfirmed(p, { channel: Channel.WHATSAPP });
    const sids = config.twilio.patientPortal as { unconfirmedExpiredSid: string | null };
    const was = sids.unconfirmedExpiredSid;
    sids.unconfirmedExpiredSid = null;
    const info = vi.spyOn(logger, 'info');
    try {
      await expect(sweepAndDeliver('unconfirmed-expired')).resolves.toBeDefined();
    } finally {
      sids.unconfirmedExpiredSid = was;
    }

    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(BookingRequestStatus.EXPIRED);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      { requestId: row.id, event: 'unconfirmed-expired' },
      'Booking request notification skipped — WhatsApp template not configured',
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain(row.verifiedPhone!);
    info.mockRestore();
  });

  it('skips the expiry message when the confirmation link was never sent', async () => {
    const p = await createLiveProvider();
    const row = await unconfirmed(p, { sent: false });

    await sweepAndDeliver('unconfirmed-expired');

    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(BookingRequestStatus.EXPIRED);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('sends nothing for a hold the patient released', async () => {
    const p = await createLiveProvider();
    const row = await unconfirmed(p, { stale: false });
    await prisma.bookingRequest.update({ where: { id: row.id }, data: { status: BookingRequestStatus.CANCELLED, resolvedBy: 'patient' } });

    await deliverBookingRequestNotification({ requestId: row.id, event: 'unconfirmed-expired' });
    await sweepAndDeliver('unconfirmed-expired');

    expect(sentJobs('unconfirmed-expired')).toHaveLength(0);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('a confirmed request that expires still gets the request-expired notice', async () => {
    const p = await createLiveProvider();
    const row = await unconfirmed(p);
    await prisma.bookingRequest.update({
      where: { id: row.id },
      data: { status: BookingRequestStatus.PENDING, confirmedAt: new Date(Date.now() - 3_600_000) },
    });

    await sweepAndDeliver('expired');

    expect(sentJobs('unconfirmed-expired')).toHaveLength(0);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify((await expiryAudit(row.id)).fieldsBefore)).toContain('PENDING');
  });

  it('does not deliver expired to an unconfirmed row, nor unconfirmed-expired to a confirmed one', async () => {
    const p = await createLiveProvider();
    const row = await unconfirmed(p);
    await bookingRequestService.sweep();

    await deliverBookingRequestNotification({ requestId: row.id, event: 'expired' });
    expect(mocks.dispatch).not.toHaveBeenCalled();

    await prisma.bookingRequest.update({ where: { id: row.id }, data: { confirmedAt: new Date() } });
    await deliverBookingRequestNotification({ requestId: row.id, event: 'unconfirmed-expired' });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('the provider is never nudged or notified about unconfirmed holds', async () => {
    const p = await createLiveProvider();
    const row = await unconfirmed(p, { stale: false });
    await prisma.$executeRaw`UPDATE booking_requests SET "createdAt" = ${new Date(Date.now() - 7 * 3_600_000)}, "holdExpiresAt" = ${new Date(Date.now() + 3_600_000)} WHERE id = ${row.id}`;

    const result = await bookingRequestService.sweep();

    expect(result.nudged).toBe(0);
    expect(sentJobs('nudge')).toHaveLength(0);
    expect(sentJobs('received')).toHaveLength(0);
    await deliverBookingRequestNotification({ requestId: row.id, event: 'nudge' });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('purges expired/cancelled unconfirmed rows after 48 hours, keeps confirmed rows 90 days', async () => {
    const p = await createLiveProvider();
    const old = new Date(Date.now() - 49 * 3_600_000);
    const expiredOld = await unconfirmed(p, { slotIndex: 0 });
    const expiredRecent = await unconfirmed(p, { slotIndex: 1 });
    const live = await unconfirmed(p, { slotIndex: 2, stale: false });
    const confirmedOld = await unconfirmed(p, { slotIndex: 3 });
    await prisma.bookingRequest.update({ where: { id: confirmedOld.id }, data: { status: BookingRequestStatus.PENDING, confirmedAt: old } });
    await prisma.$transaction((tx) => bookingRequestService.expireStaleWithin(tx, p.id, new Date()));
    await prisma.$executeRaw`UPDATE booking_requests SET "updatedAt" = ${old} WHERE id IN (${expiredOld.id}, ${confirmedOld.id}, ${live.id})`;

    await bookingRequestService.purgeResolved();

    const remaining = (await prisma.bookingRequest.findMany({ where: { userId: p.id }, select: { id: true } })).map((r) => r.id);
    expect(remaining).not.toContain(expiredOld.id);
    expect(remaining).toContain(expiredRecent.id);
    expect(remaining).toContain(live.id);
    expect(remaining).toContain(confirmedOld.id);
  });

  it('without the scheduler, a new booking delivers the unconfirmed-expired notice of the hold it expired', async () => {
    scheduler.enabled = false;
    const p = await createLiveProvider();
    const old = await unconfirmed(p, { slotIndex: 0 });
    const next = (await slotStarts(p, 3))[1]!;

    await bookingStartService.start(p.slug, {
      typeId: p.typeId,
      locationId: p.locationId,
      startUtc: next,
      patientTimezone: 'America/New_York',
      consentAccepted: true,
      captchaToken: 'good',
      patient: { name: 'Ana', lastName: 'Perez', phone: '+573001112233' },
      contact: { channel: 'EMAIL', email: 'nueva@example.com' },
    } as never, { ipAddress: '203.0.113.5', userAgent: 'vitest' } as never);

    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: old.id } })).status).toBe(BookingRequestStatus.EXPIRED);
    const recipients = mocks.dispatch.mock.calls.map((c) => (c[1] as { to: string }).to);
    expect(recipients).toContain(old.email);
    expect(recipients).toContain('nueva@example.com');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('without the scheduler, a new booking delivers the request-expired notice of a confirmed hold it expired', async () => {
    scheduler.enabled = false;
    const p = await createLiveProvider();
    const [ first, next ] = (await slotStarts(p, 3)) as [ string, string ];
    const email = 'confirmada@example.com';
    const confirmed = await prisma.$transaction(async (tx) => {
      await withProviderLock(tx, p.id);
      return (await createPendingRequestWithin(tx, p.id, {
        email, name: 'Lucia', lastName: 'Rojas', typeId: p.typeId, locationId: p.locationId,
        startAt: new Date(first), endAt: new Date(new Date(first).getTime() + 3_600_000), patientTimezone: 'America/Bogota',
        policyVersion: 'v', consentAcceptedAt: new Date(),
      })).request;
    });
    await prisma.bookingRequest.update({ where: { id: confirmed.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    mocks.dispatch.mockClear();

    await bookingStartService.start(p.slug, {
      typeId: p.typeId, locationId: p.locationId, startUtc: next, patientTimezone: 'America/New_York', consentAccepted: true,
      captchaToken: 'good', patient: { name: 'Ana', lastName: 'Perez', phone: '+573001112233' },
      contact: { channel: 'EMAIL', email: 'otra@example.com' },
    } as never, { ipAddress: '203.0.113.5', userAgent: 'vitest' } as never);

    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: confirmed.id } })).status).toBe(BookingRequestStatus.EXPIRED);
    const toConfirmed = mocks.dispatch.mock.calls.filter((c) => (c[1] as { to: string }).to === email);
    expect(toConfirmed).toHaveLength(1);
    expect((toConfirmed[0]![1] as { subject: string }).subject).toMatch(/solicitud/i);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
