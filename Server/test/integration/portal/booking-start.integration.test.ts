import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), send: vi.fn() }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: () => ({ send: mocks.send }) }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { logger } from '../../../src/utils/api/logger.js';
import { hashRequestToken } from '../../../src/booking-requests/request-token.js';
import { PORTAL_ANONYMOUS_ACTOR_ID } from '../../../src/audit-log/audit-actors.js';
import { TURNSTILE_SITEVERIFY_URL } from '../../../src/captcha/turnstile.js';
import { AppointmentStatus, BookingApprovalMode, BookingRequestStatus, Channel, ActionSource } from '../../../generated/prisma/enums.js';
import { DateTime } from 'luxon';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import { createTestAppointmentType, createTestLocation, createTestPatient } from '../helpers.js';
import { PORTAL_ZONE, buildPortalApp, createLiveProvider, slotStarts, type LiveProvider } from './portal-helpers.js';

const realFetch = globalThis.fetch;
function stubSiteverify() {
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
    if (String(url) !== TURNSTILE_SITEVERIFY_URL) return realFetch(url as string, init);
    const { response } = JSON.parse(String(init?.body)) as { response: string };
    const success = response === 'good';
    return new Response(JSON.stringify({
      success,
      ...(success
        ? { hostname: 'localhost', action: 'booking', challenge_ts: new Date().toISOString() }
        : { 'error-codes': [ 'invalid-input-response' ] }),
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
}

let app: express.Express;
const portal = config.portal as { patientEnabled: boolean; whatsappDailyCap: number };
const portalWas = portal.patientEnabled;
const capWas = portal.whatsappDailyCap;
const scheduler = config.scheduler as { enabled: boolean };
const schedulerWas = scheduler.enabled;
beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = portalWas; scheduler.enabled = schedulerWas; });
beforeEach(() => {
  app = buildPortalApp();
  scheduler.enabled = false;
  mocks.dispatch.mockReset().mockResolvedValue({ success: true, messageSid: 'msg-1' });
  mocks.send.mockReset().mockResolvedValue('job-1');
  stubSiteverify();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  portal.whatsappDailyCap = capWas;
});

let seq = 0;
const email = () => `paciente${++seq}-${Date.now()}@test.local`;

function emailBody(p: LiveProvider, startUtc: string, over: Record<string, unknown> = {}) {
  return {
    typeId: p.typeId,
    locationId: p.locationId,
    startUtc,
    patientTimezone: 'America/New_York',
    consentAccepted: true,
    captchaToken: 'good',
    patient: { name: 'Lucia', lastName: 'Rojas', phone: '+573001112233' },
    contact: { channel: 'EMAIL', email: email() },
    ...over,
  };
}

const waBody = (p: LiveProvider, startUtc: string, phone = '+573009998877') =>
  emailBody(p, startUtc, { patient: { name: 'Lucia', lastName: 'Rojas' }, contact: { channel: 'WHATSAPP', phone } });

const startBooking = (slug: string, body: unknown, ip = '203.0.113.1') =>
  request(app).post(`/v1/public/providers/${slug}/bookings`).set('X-Forwarded-For', ip).send(body as object);

const release = (releaseToken: string) =>
  request(app).post('/v1/public/booking-confirmations/release').send({ releaseToken });

const confirmToken = (text: string) => /\/book\/confirmar\/([A-Za-z0-9_-]{43})/.exec(text)?.[1];

describe('POST /v1/public/providers/:slug/bookings', () => {
  it('creates an UNCONFIRMED hold for 15 minutes and emails the link after commit', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const res = await startBooking(provider.slug, emailBody(provider, start!));

    expect(res.status).toBe(202);
    expect(res.headers['cache-control']).toBe('no-store');
    const row = await prisma.bookingRequest.findFirstOrThrow({ where: { userId: provider.id } });
    expect(row.status).toBe('UNCONFIRMED');
    expect(row.holdExpiresAt.getTime() - row.createdAt.getTime()).toBeLessThanOrEqual(15 * 60_000 + 1000);
    expect(row.confirmedAt).toBeNull();
    expect(row.confirmationSentAt).not.toBeNull();
    const [ channel, opts ] = mocks.dispatch.mock.calls[0]!;
    expect(channel).toBe(Channel.EMAIL);
    expect(opts.body).toMatch(/\/book\/confirmar\/[A-Za-z0-9_-]{43}/);
    expect(res.body.data.releaseToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Object.keys(res.body.data).sort()).toEqual(
      [ 'approvalRequired', 'channel', 'contact', 'holdExpiresAt', 'releaseToken', 'startUtc' ],
    );
  });

  it('never stores the tokens in plaintext', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const res = await startBooking(provider.slug, emailBody(provider, start!));
    const confirm = confirmToken(mocks.dispatch.mock.calls[0]![1].body)!;
    const releaseToken = res.body.data.releaseToken as string;
    const row = await prisma.bookingRequest.findFirstOrThrow({ where: { userId: provider.id } });

    expect(confirm).not.toBe(releaseToken);
    expect(row.confirmTokenHash).toBe(hashRequestToken(confirm));
    expect(row.releaseTokenHash).toBe(hashRequestToken(releaseToken));
    expect(row.confirmTokenHash).not.toBe(confirm);
    expect(row.releaseTokenHash).not.toBe(releaseToken);
    const audits = JSON.stringify(await prisma.auditLog.findMany({ where: { userId: provider.id } }));
    expect(audits).not.toContain(confirm);
    expect(audits).not.toContain(releaseToken);
  });

  it('touches no patient, consent or appointment, and answers byte-identically for a new email and a patient\'s', async () => {
    const provider = await createLiveProvider();
    const known = await createTestPatient(provider.id, { email: email() });
    const [ s1, s2 ] = await slotStarts(provider);
    const fresh = emailBody(provider, s1!, { contact: { channel: 'EMAIL', email: 'nuevo@test.local' } });
    const seen = emailBody(provider, s2!, { contact: { channel: 'EMAIL', email: known.email! } });
    const before = await prisma.patient.count({ where: { userId: provider.id } });

    const a = await startBooking(provider.slug, fresh);
    const b = await startBooking(provider.slug, seen);

    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    const shape = (r: request.Response, start: string, contact: string) =>
      JSON.stringify({ ...r.body, timestamp: 't', data: { ...r.body.data, releaseToken: 'x', holdExpiresAt: 'x', startUtc: start, contact } });
    expect(shape(a, 's', 'c')).toBe(shape(b, 's', 'c'));
    expect(Object.keys(a.body.data)).toEqual(Object.keys(b.body.data));
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(before);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(0);
    const audits = await prisma.auditLog.findMany({ where: { userId: provider.id } });
    expect(audits.length).toBeGreaterThan(0);
    expect(audits.every((x) => x.source === ActionSource.PUBLIC_PORTAL && x.actorId === PORTAL_ANONYMOUS_ACTOR_ID)).toBe(true);
  });

  it('sends WhatsApp through the confirm-link template with the token as variable 4', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const res = await startBooking(provider.slug, waBody(provider, start!));

    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ channel: 'WHATSAPP', contact: '+573009998877' });
    const [ channel, opts ] = mocks.dispatch.mock.calls[0]!;
    expect(channel).toBe(Channel.WHATSAPP);
    expect(opts.to).toBe('+573009998877');
    expect(opts.contentSid).toBe(config.twilio.patientPortal.confirmLinkSid);
    expect(opts.contentVariables['4']).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await prisma.bookingRequest.findFirstOrThrow({ where: { userId: provider.id } });
    expect(row).toMatchObject({ contactChannel: Channel.WHATSAPP, verifiedPhone: '+573009998877', email: null });
    expect(row.confirmTokenHash).toBe(hashRequestToken(opts.contentVariables['4']));
  });

  it('a hit WhatsApp cap creates nothing and answers 409 WhatsAppUnavailableError', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    portal.whatsappDailyCap = 0;
    const errors = vi.spyOn(logger, 'error');

    const res = await startBooking(provider.slug, waBody(provider, start!));

    expect(res.status).toBe(409);
    expect(res.body.error ?? res.body.message).toMatch(/WhatsApp/);
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id } })).toBe(0);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith('Portal WhatsApp cap reached: paid-daily-cap');
  });

  it('the 6th live unconfirmed hold for a provider answers 429; confirmed PENDING requests do not count', async () => {
    const provider = await createLiveProvider();
    const starts = await slotStarts(provider);
    for (let i = 0; i < 5; i++) {
      expect((await startBooking(provider.slug, emailBody(provider, starts[i]!))).status).toBe(202);
    }
    const sixth = await startBooking(provider.slug, emailBody(provider, starts[5]!));
    expect(sixth.status).toBe(429);
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id } })).toBe(5);

    const one = await prisma.bookingRequest.findFirstOrThrow({ where: { userId: provider.id } });
    await prisma.bookingRequest.update({ where: { id: one.id }, data: { status: BookingRequestStatus.PENDING, confirmedAt: new Date() } });
    expect((await startBooking(provider.slug, emailBody(provider, starts[5]!))).status).toBe(202);
  });

  it("the per-contact cap counts only the contact's unconfirmed holds (4th -> PortalRequestLimitError)", async () => {
    const provider = await createLiveProvider();
    const starts = await slotStarts(provider);
    const contact = { channel: 'EMAIL', email: email() };
    for (let i = 0; i < 3; i++) {
      expect((await startBooking(provider.slug, emailBody(provider, starts[i]!, { contact }))).status).toBe(202);
    }
    const fourth = await startBooking(provider.slug, emailBody(provider, starts[3]!, { contact }));
    expect(fourth.status).toBe(409);
    expect(JSON.stringify(fourth.body)).toContain('Request limit reached');
  });

  it("start ignores the contact's PENDING requests: an anonymous caller learns nothing about them", async () => {
    const provider = await createLiveProvider();
    const starts = await slotStarts(provider);
    const contact = { channel: 'EMAIL', email: email() };
    for (let i = 0; i < 3; i++) {
      expect((await startBooking(provider.slug, emailBody(provider, starts[i]!, { contact }))).status).toBe(202);
    }
    await prisma.bookingRequest.updateMany({
      where: { userId: provider.id },
      data: { status: BookingRequestStatus.PENDING, confirmedAt: new Date() },
    });
    expect((await startBooking(provider.slug, emailBody(provider, starts[3]!, { contact }))).status).toBe(202);
  });

  it('an email gets 5 starts per hour, in any status: the 6th answers 429 and creates nothing', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const contact = { channel: 'EMAIL', email: email() };
    for (let i = 0; i < 5; i++) {
      const res = await startBooking(provider.slug, emailBody(provider, start!, { contact }));
      expect(res.status).toBe(202);
      expect((await release(res.body.data.releaseToken)).status).toBe(204);
    }
    mocks.dispatch.mockClear();

    const sixth = await startBooking(provider.slug, emailBody(provider, start!, { contact }));

    expect(sixth.status).toBe(429);
    expect(sixth.body.error).toBe('No hay cupo para nuevas reservas en este momento. Intenta de nuevo en un rato.');
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id } })).toBe(5);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect((await startBooking(provider.slug, emailBody(provider, start!))).status).toBe(202);
  });

  it('the same WhatsApp number booking 4 times: the 4th is PortalRequestLimitError (per-contact cap runs before the paid caps)', async () => {
    const provider = await createLiveProvider();
    const starts = await slotStarts(provider);
    for (let i = 0; i < 3; i++) {
      expect((await startBooking(provider.slug, waBody(provider, starts[i]!, '+573005550001'))).status).toBe(202);
    }
    const fourth = await startBooking(provider.slug, waBody(provider, starts[3]!, '+573005550001'));
    expect(fourth.status).toBe(409);
    expect(JSON.stringify(fourth.body)).toContain('Request limit reached');
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id } })).toBe(3);
  });

  it('a held slot answers SlotUnavailableError 409 to a second patient', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    expect((await startBooking(provider.slug, emailBody(provider, start!))).status).toBe(202);
    const second = await startBooking(provider.slug, emailBody(provider, start!));
    expect(second.status).toBe(409);
    expect(JSON.stringify(second.body)).toContain('Slot no longer available');
  });

  it('requires CAPTCHA and a strict body; patient.phone with WHATSAPP is 400', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    expect((await startBooking(provider.slug, emailBody(provider, start!, { captchaToken: 'bad' }))).status).toBe(400);
    const { captchaToken: _omit, ...noCaptcha } = emailBody(provider, start!);
    expect((await startBooking(provider.slug, noCaptcha)).status).toBe(400);
    expect((await startBooking(provider.slug, { ...emailBody(provider, start!), extra: 1 })).status).toBe(400);
    expect((await startBooking(provider.slug, emailBody(provider, start!, { consentAccepted: false }))).status).toBe(400);
    const withPhone = await startBooking(provider.slug, emailBody(provider, start!, {
      contact: { channel: 'WHATSAPP', phone: '+573009998877' },
    }));
    expect(withPhone.status).toBe(400);
    expect(JSON.stringify(withPhone.body)).toContain('phone is only for email bookings');
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id } })).toBe(0);
  });

  it('notifies the provider of nothing', async () => {
    scheduler.enabled = true;
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    expect((await startBooking(provider.slug, emailBody(provider, start!))).status).toBe(202);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });

  it('works in approval mode and reports approvalRequired', async () => {
    const provider = await createLiveProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });
    const [ start ] = await slotStarts(provider);
    const res = await startBooking(provider.slug, emailBody(provider, start!));
    expect(res.status).toBe(202);
    expect(res.body.data.approvalRequired).toBe(true);
  });

  it('a send failure releases the hold and answers 503: the patient is never told to check an inbox for nothing', async () => {
    for (const fail of [
      () => mocks.dispatch.mockResolvedValueOnce({ success: false, error: 'boom' }),
      () => mocks.dispatch.mockRejectedValueOnce(new Error('network')),
    ]) {
      const provider = await createLiveProvider();
      const [ start ] = await slotStarts(provider);
      fail();
      const res = await startBooking(provider.slug, emailBody(provider, start!));

      expect(res.status).toBe(503);
      expect(res.body.data).toBeUndefined();
      const row = await prisma.bookingRequest.findFirstOrThrow({ where: { userId: provider.id } });
      expect(row).toMatchObject({ status: 'CANCELLED', resolvedBy: 'system', confirmationSentAt: null, confirmedAt: null });
      const audits = await prisma.auditLog.findMany({ where: { entityId: row.id } });
      const released = audits.find((a) => a.description.includes('no se pudo enviar'));
      expect(released).toMatchObject({ source: ActionSource.PUBLIC_PORTAL, actorId: PORTAL_ANONYMOUS_ACTOR_ID });
      expect((await startBooking(provider.slug, emailBody(provider, start!))).status).toBe(202);
    }
  });

  it('never logs the token', async () => {
    const spies = [ 'info', 'warn', 'error', 'debug' ].map((level) => vi.spyOn(logger, level as 'info'));
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const res = await startBooking(provider.slug, emailBody(provider, start!));
    const confirm = confirmToken(mocks.dispatch.mock.calls[0]![1].body)!;
    await release(res.body.data.releaseToken);
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain(confirm);
    expect(logged).not.toContain(res.body.data.releaseToken);
  });

  it('never logs the token when the link is not accepted or the send throws', async () => {
    const spies = [ 'info', 'warn', 'error', 'debug' ].map((level) => vi.spyOn(logger, level as 'info'));
    const provider = await createLiveProvider();
    const [ s1, s2 ] = await slotStarts(provider);

    mocks.dispatch.mockResolvedValueOnce({ success: false, error: 'boom' });
    const refused = await startBooking(provider.slug, emailBody(provider, s1!));
    mocks.dispatch.mockRejectedValueOnce(new Error('network'));
    const thrown = await startBooking(provider.slug, waBody(provider, s2!));

    expect([ refused.status, thrown.status ]).toEqual([ 503, 503 ]);
    const tokens = [
      confirmToken(mocks.dispatch.mock.calls[0]![1].body)!,
      mocks.dispatch.mock.calls[1]![1].contentVariables['4'] as string,
    ];
    expect(tokens.every((t) => /^[A-Za-z0-9_-]{43}$/.test(t))).toBe(true);
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).toContain('Booking confirmation link');
    for (const token of tokens) expect(logged).not.toContain(token);
  });
});

describe('POST /v1/public/booking-confirmations/release', () => {
  it('cancels the hold and frees the slot without any message', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const res = await startBooking(provider.slug, emailBody(provider, start!));
    mocks.dispatch.mockClear();

    const out = await release(res.body.data.releaseToken);

    expect(out.status).toBe(204);
    const row = await prisma.bookingRequest.findFirstOrThrow({ where: { userId: provider.id } });
    expect(row.status).toBe('CANCELLED');
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect((await startBooking(provider.slug, emailBody(provider, start!))).status).toBe(202);
    const audits = await prisma.auditLog.findMany({ where: { userId: provider.id } });
    expect(audits.some((a) => a.description.includes('liberada'))).toBe(true);
    expect((await release(res.body.data.releaseToken)).status).toBe(404);
  });

  it('answers 404 for an unknown token or a confirmed request, and changes nothing', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const res = await startBooking(provider.slug, emailBody(provider, start!));

    expect((await release('x'.repeat(43))).status).toBe(404);
    await prisma.bookingRequest.updateMany({
      where: { userId: provider.id },
      data: { status: BookingRequestStatus.PENDING, confirmedAt: new Date() },
    });
    expect((await release(res.body.data.releaseToken)).status).toBe(404);
    const row = await prisma.bookingRequest.findFirstOrThrow({ where: { userId: provider.id } });
    expect(row.status).toBe('PENDING');
  });
});

const localAt = (daysAhead: number, hour: number) =>
  DateTime.now().setZone(PORTAL_ZONE).plus({ days: daysAhead }).set({ hour, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO()!;

describe('slot rules for a new hold', () => {
  it('rejects starts the slot engine would not offer with the same neutral 409', async () => {
    const provider = await createLiveProvider({ bufferMinutes: 30 });
    const slots = await slotStarts(provider);
    const busyPatient = await createTestPatient(provider.id);
    await prisma.appointment.create({
      data: {
        userId: provider.id, patientId: busyPatient.id, startAt: new Date(slots[2]!),
        endAt: new Date(new Date(slots[2]!).getTime() + 60 * 60_000), price: 0, status: AppointmentStatus.SCHEDULED,
      },
    });
    await prisma.blockedTime.create({
      data: { userId: provider.id, startTimeUtc: new Date(slots[6]!), endTimeUtc: new Date(new Date(slots[6]!).getTime() + 15 * 60_000) },
    });
    const offGrid = new Date(new Date(slots[4]!).getTime() + 30 * 60_000).toISOString();

    for (const start of [ slots[1]!, slots[2]!, slots[6]!, offGrid, localAt(3, 20), localAt(-1, 9), localAt(40, 9) ]) {
      const res = await startBooking(provider.slug, emailBody(provider, start));
      expect({ start, status: res.status, error: res.body.error }).toEqual({ start, status: 409, error: 'Slot no longer available' });
    }
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id } })).toBe(0);
  });

  it('rejects an on-grid start whose appointment would overrun the window, and holds the type duration otherwise', async () => {
    const provider = await createLiveProvider();
    await prisma.appointmentType.update({ where: { id: provider.typeId }, data: { defaultDuration: 90 } });

    const overrun = await startBooking(provider.slug, emailBody(provider, localAt(3, 17)));
    expect({ status: overrun.status, error: overrun.body.error }).toEqual({ status: 409, error: 'Slot no longer available' });
    expect((await startBooking(provider.slug, emailBody(provider, localAt(3, 16)))).status).toBe(202);
    const row = await prisma.bookingRequest.findFirstOrThrow({ where: { userId: provider.id } });
    expect(row.endAt.getTime() - row.startAt.getTime()).toBe(90 * 60_000);
  });

  it('stays a 404 when booking is not live, in either approval mode', async () => {
    for (const mode of [ BookingApprovalMode.AUTO_CONFIRM, BookingApprovalMode.REQUIRE_APPROVAL ]) {
      const provider = await createLiveProvider();
      const [ start ] = await slotStarts(provider);
      await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: mode, bookingEnabled: false } });
      const res = await startBooking(provider.slug, emailBody(provider, start!));
      expect(res.status).toBe(404);
      expect(await prisma.bookingRequest.count({ where: { userId: provider.id } })).toBe(0);
    }
  });

  it('allows back-to-back holds when the buffer is 0', async () => {
    const provider = await createLiveProvider();
    const [ first, second ] = await slotStarts(provider);
    expect((await startBooking(provider.slug, emailBody(provider, first!))).status).toBe(202);
    expect((await startBooking(provider.slug, emailBody(provider, second!))).status).toBe(202);
  });

  it('lets exactly one of two concurrent bookings of the same slot win', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const results = await Promise.all([
      startBooking(provider.slug, emailBody(provider, start!)),
      startBooking(provider.slug, emailBody(provider, start!)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([ 202, 409 ]);
    expect(results.find((r) => r.status === 409)!.body.error).toBe('Slot no longer available');
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id } })).toBe(1);
  });

  it('answers 404 for a type or location that is not bookable online', async () => {
    const provider = await createLiveProvider();
    const other = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const hiddenType = await createTestAppointmentType(provider.id);
    const hiddenLocation = await createTestLocation(provider.id);
    const inactiveType = await createTestAppointmentType(provider.id);
    await prisma.appointmentType.update({ where: { id: inactiveType.id }, data: { bookableOnline: true, isActive: false } });

    const cases: [ Record<string, unknown>, string ][] = [
      [ { typeId: hiddenType.id }, 'Appointment type not found' ],
      [ { typeId: inactiveType.id }, 'Appointment type not found' ],
      [ { typeId: other.typeId }, 'Appointment type not found' ],
      [ { locationId: hiddenLocation.id }, 'Location not found' ],
      [ { locationId: other.locationId }, 'Location not found' ],
    ];
    for (const [ override, error ] of cases) {
      const res = await startBooking(provider.slug, emailBody(provider, start!, override));
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 404, error });
    }
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id } })).toBe(0);
  });

  it('an admin create racing a hold always succeeds: the provider wins over an unconfirmed hold', async () => {
    const provider = await createLiveProvider();
    const adminPatient = await createTestPatient(provider.id);
    const [ start ] = await slotStarts(provider);
    const end = new Date(new Date(start!).getTime() + 60 * 60_000).toISOString();

    const [ holdRes, adminRes ] = await Promise.allSettled([
      startBooking(provider.slug, emailBody(provider, start!)),
      appointmentService.create({
        startAt: start!, endAt: end, price: 0, paid: false, status: AppointmentStatus.SCHEDULED,
        patientId: adminPatient.id, locationId: provider.locationId, typeId: provider.typeId,
      }, provider.id),
    ]);

    expect(adminRes.status).toBe('fulfilled');
    expect(holdRes.status === 'fulfilled' && [ 202, 409 ].includes(holdRes.value.status)).toBe(true);
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(1);
  });
});
