import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), send: vi.fn() }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: () => ({ send: mocks.send }) }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { logger } from '../../../src/utils/api/logger.js';
import { TURNSTILE_SITEVERIFY_URL } from '../../../src/captcha/turnstile.js';
import { PRIVACY_POLICY_VERSION } from '../../../src/portal/privacy-policy.js';
import { MAX_PENDING_REQUESTS_PER_PROVIDER } from '../../../src/booking-requests/booking-request.constants.js';
import {
  ActionSource,
  AppointmentStatus,
  BookingApprovalMode,
  Channel,
  ConsentKind,
  EntityType,
  PatientStatus,
  RecordSource,
} from '../../../generated/prisma/enums.js';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import { createTestLocation, createTestPatient } from '../helpers.js';
import { DateTime } from 'luxon';
import { PORTAL_ZONE, buildPortalApp, createLiveProvider, slotStarts, type LiveProvider } from './portal-helpers.js';

const realFetch = globalThis.fetch;
function stubSiteverify() {
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
    if (String(url) !== TURNSTILE_SITEVERIFY_URL) return realFetch(url as string, init);
    return new Response(JSON.stringify({
      success: true, hostname: 'localhost', action: 'booking', challenge_ts: new Date().toISOString(),
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
}

let app: express.Express;
const portal = config.portal as { patientEnabled: boolean };
const portalWas = portal.patientEnabled;
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

let seq = 0;
const newEmail = () => `confirma${++seq}-${Date.now()}@test.local`;

type Contact = { channel: 'EMAIL'; email: string } | { channel: 'WHATSAPP'; phone: string };

function startBody(p: LiveProvider, startUtc: string, contact: Contact, phone?: string) {
  return {
    typeId: p.typeId,
    locationId: p.locationId,
    startUtc,
    patientTimezone: 'America/New_York',
    consentAccepted: true,
    captchaToken: 'good',
    patient: { name: 'Lucia', lastName: 'Rojas', ...(phone && { phone }) },
    contact,
  };
}

async function book(p: LiveProvider, startUtc: string, contact: Contact = { channel: 'EMAIL', email: newEmail() }, phone?: string) {
  const before = mocks.dispatch.mock.calls.length;
  const res = await request(app).post(`/v1/public/providers/${p.slug}/bookings`).send(startBody(p, startUtc, contact, phone));
  expect(res.status).toBe(202);
  const [ , opts ] = mocks.dispatch.mock.calls[before]!;
  const token = contact.channel === 'EMAIL'
    ? /\/book\/confirmar\/([A-Za-z0-9_-]{43})/.exec(opts.body)![1]!
    : opts.contentVariables['4'] as string;
  mocks.dispatch.mockClear();
  return token;
}

const view = (token: string) => request(app).post('/v1/public/booking-confirmations/view').send({ token });
const confirm = (token: string) => request(app).post('/v1/public/booking-confirmations/confirm').send({ token });
const rowsOf = (userId: string) => prisma.bookingRequest.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
const rowOf = async (userId: string) => (await rowsOf(userId))[0]!;

const approvalProvider = async () => {
  const provider = await createLiveProvider();
  await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });
  return provider;
};

describe('POST /v1/public/booking-confirmations/view', () => {
  it('view never changes state (scanner-safe)', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!);

    const first = await view(token);
    await view(token);

    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe('no-store');
    expect((await rowOf(provider.id)).status).toBe('UNCONFIRMED');
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(0);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('describes the booking without any patient detail', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!);

    const res = await view(token);

    const data = res.body.data;
    expect(Object.keys(data).sort()).toEqual([
      'approvalRequired', 'durationMinutes', 'holdExpiresAt', 'location', 'patientTimezone', 'providerContact', 'providerName',
      'providerSlug', 'startUtc', 'state', 'typeName',
    ]);
    expect(data).toMatchObject({
      state: 'unconfirmed',
      providerSlug: provider.slug,
      providerName: 'Test User',
      startUtc: start,
      durationMinutes: expect.any(Number),
      patientTimezone: 'America/New_York',
      approvalRequired: false,
      providerContact: { phone: '+573001234567', whatsapp: null },
    });
    expect(Object.keys(data.location).sort()).toEqual([ 'address', 'isVirtual', 'name' ]);
    expect(JSON.stringify(res.body)).not.toMatch(/Lucia|Rojas|@test\.local/);
  });

  it('an unknown token is 404 and the token never appears in logs', async () => {
    const spies = [ 'info', 'warn', 'error', 'debug' ].map((level) => vi.spyOn(logger, level as 'info'));
    const provider = await createLiveProvider();
    const [ s1, s2 ] = await slotStarts(provider);
    const unknown = 'u'.repeat(43);

    const res = await view(unknown);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Este enlace no es válido.');
    expect((await confirm(unknown)).status).toBe(404);

    const viewed = await book(provider, s1!);
    await view(viewed);
    await confirm(viewed);
    const refused = await book(provider, s2!);
    await prisma.user.update({ where: { id: provider.id }, data: { bookingEnabled: false } });
    expect((await confirm(refused)).status).toBe(404);

    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const token of [ unknown, viewed, refused ]) expect(logged).not.toContain(token);
  });

  it('a link of a provider no longer reachable answers like an unknown token', async () => {
    for (const unreach of [
      (id: string) => prisma.user.update({ where: { id }, data: { bookingSlug: null } }),
      (id: string) => prisma.user.update({ where: { id }, data: { deletedAt: new Date() } }),
    ]) {
      const provider = await createLiveProvider();
      const [ start ] = await slotStarts(provider);
      const token = await book(provider, start!);
      await unreach(provider.id);

      const res = await view(token);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Este enlace no es válido.');
      expect(JSON.stringify(res.body)).not.toContain('+573001234567');
    }
  });

  it('a confirmed booking shows the appointment as it is now, after the provider moved it', async () => {
    const provider = await createLiveProvider();
    const [ start, later ] = await slotStarts(provider);
    const token = await book(provider, start!);
    expect((await confirm(token)).body.data.state).toBe('confirmed');
    const { appointmentId } = await rowOf(provider.id);
    const location = await createTestLocation(provider.id);
    await prisma.appointment.update({
      where: { id: appointmentId! },
      data: { startAt: new Date(later!), endAt: new Date(new Date(later!).getTime() + 45 * 60_000), locationId: location.id },
    });

    const data = (await view(token)).body.data;

    expect(data).toMatchObject({ state: 'confirmed', startUtc: later, durationMinutes: 45 });
    expect(data.location.name).toBe(location.name);
  });
});

describe('POST /v1/public/booking-confirmations/confirm', () => {
  it('auto-confirm: creates patient, consent (accepted at booking time) and a CONFIRMED PORTAL appointment; row APPROVED with ids and confirmedAt', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const email = newEmail();
    const token = await book(provider, start!, { channel: 'EMAIL', email }, '+573001112233');
    const booked = await rowOf(provider.id);

    const res = await confirm(token);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.state).toBe('confirmed');
    const [ patient ] = await prisma.patient.findMany({ where: { userId: provider.id } });
    expect(patient).toMatchObject({
      name: 'Lucia', lastName: 'Rojas', email, whatsappNumber: '+573001112233', whatsappUnverified: true,
      reminderChannel: Channel.EMAIL, source: RecordSource.PORTAL, status: PatientStatus.ACTIVE,
    });
    const [ consent ] = await prisma.patientConsent.findMany({ where: { userId: provider.id } });
    expect(consent!.patientId).toBe(patient!.id);
    expect(consent!.policyVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(consent!.acceptedAt.getTime()).toBe(booked.consentAcceptedAt.getTime());
    const [ appt ] = await prisma.appointment.findMany({ where: { userId: provider.id } });
    expect(appt).toMatchObject({
      patientId: patient!.id, status: AppointmentStatus.CONFIRMED, source: RecordSource.PORTAL, patientTimezone: 'America/New_York',
    });
    expect(appt!.startAt.toISOString()).toBe(start);
    const row = await rowOf(provider.id);
    expect(row).toMatchObject({ status: 'APPROVED', resolvedBy: 'patient', appointmentId: appt!.id, patientId: patient!.id });
    expect(row.confirmedAt).not.toBeNull();
    expect(row.resolvedAt).not.toBeNull();

    const audits = await prisma.auditLog.findMany({ where: { userId: provider.id, entityType: EntityType.BOOKING_REQUEST, entityId: row.id } });
    const confirmed = audits.find((a) => a.actorId !== 'portal:anonymous');
    expect(confirmed).toMatchObject({ source: ActionSource.PUBLIC_PORTAL, portalPatientId: patient!.id });
    const carried = audits.map((a) => [ a.description, a.affectedFields, a.fieldsBefore, a.fieldsAfter ]);
    expect(JSON.stringify(carried)).not.toMatch(/Lucia|Rojas|@test\.local|\+57/);
  });

  it('auto-confirm for a returning patient reuses the record and modifies nothing', async () => {
    const provider = await createLiveProvider();
    const known = await createTestPatient(provider.id, { email: newEmail() });
    await prisma.patientConsent.create({
      data: { patientId: known.id, userId: provider.id, kind: ConsentKind.DATA_PROCESSING, policyVersion: PRIVACY_POLICY_VERSION, acceptedAt: new Date() },
    });
    const before = await prisma.patient.findUniqueOrThrow({ where: { id: known.id } });
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!, { channel: 'EMAIL', email: known.email! }, '+573001112233');

    expect((await confirm(token)).body.data.state).toBe('confirmed');

    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(1);
    const after = await prisma.patient.findUniqueOrThrow({ where: { id: known.id } });
    expect(after).toEqual(before);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(1);
    const [ appt ] = await prisma.appointment.findMany({ where: { userId: provider.id } });
    expect(appt!.patientId).toBe(known.id);
    expect((await rowOf(provider.id)).patientId).toBe(known.id);
  });

  it('approval mode: row becomes PENDING with a 48h hold, confirmedAt set, provider gets the received notice; no patient touched', async () => {
    const provider = await approvalProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { reminderActive: true, reminderChannel: Channel.EMAIL } });
    const provEmail = (await prisma.user.findUniqueOrThrow({ where: { id: provider.id } })).email;
    const starts = await slotStarts(provider, 5);
    const start = starts[0]!;
    const token = await book(provider, start);

    const viewed = await view(token);
    expect(viewed.body.data).toMatchObject({ state: 'unconfirmed', approvalRequired: true });
    const res = await confirm(token);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ state: 'requested', approvalRequired: true });
    const row = await rowOf(provider.id);
    expect(row).toMatchObject({ status: 'PENDING', kind: 'NEW' });
    expect(row.confirmedAt).not.toBeNull();
    const expected = Math.min(row.confirmedAt!.getTime() + 48 * 3_600_000, new Date(start).getTime());
    expect(row.holdExpiresAt.getTime()).toBe(expected);
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(0);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    const [ channel, opts ] = mocks.dispatch.mock.calls[0]!;
    expect(channel).toBe(Channel.EMAIL);
    expect(opts.to).toBe(provEmail);
    expect(opts.body).toContain('nueva solicitud');
  });

  it('approval mode with the scheduler on enqueues the received notice on the transaction', async () => {
    scheduler.enabled = true;
    const provider = await approvalProvider();
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!);
    mocks.send.mockClear();

    await confirm(token);

    const row = await rowOf(provider.id);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0]![1]).toEqual({ requestId: row.id, event: 'received' });
    expect(mocks.send.mock.calls[0]![2]).toHaveProperty('db');
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('review routing: an inactive match becomes a PENDING REVIEW request', async () => {
    const provider = await createLiveProvider();
    const inactive = await createTestPatient(provider.id, { email: newEmail() });
    await prisma.patient.update({ where: { id: inactive.id }, data: { status: PatientStatus.INACTIVE } });
    const before = await prisma.patient.findUniqueOrThrow({ where: { id: inactive.id } });
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!, { channel: 'EMAIL', email: inactive.email! });

    const res = await confirm(token);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ state: 'requested', approvalRequired: true });
    const row = await rowOf(provider.id);
    expect(row).toMatchObject({ status: 'PENDING', kind: 'REVIEW', patientId: null, appointmentId: null });
    expect(row.confirmedAt).not.toBeNull();
    expect(await prisma.patient.findUniqueOrThrow({ where: { id: inactive.id } })).toEqual(before);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(0);
  });

  it('the 50 live pending requests per provider apply when an approval-mode booking is confirmed (hold released)', async () => {
    const provider = await approvalProvider();
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!);
    const far = new Date(Date.now() + 20 * 86_400_000);
    const base = await rowOf(provider.id);
    await prisma.bookingRequest.createMany({
      data: Array.from({ length: MAX_PENDING_REQUESTS_PER_PROVIDER }, (_, i) => ({
        userId: provider.id, typeId: provider.typeId, locationId: provider.locationId, name: 'X', lastName: 'Y', email: null,
        startAt: new Date(far.getTime() + i * 3_600_000), endAt: new Date(far.getTime() + (i + 1) * 3_600_000),
        patientTimezone: 'UTC', holdExpiresAt: new Date(Date.now() + 86_400_000), policyVersion: base.policyVersion,
        consentAcceptedAt: new Date(), confirmedAt: new Date(),
      })),
    });

    const res = await confirm(token);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Request capacity reached');
    const row = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: base.id } });
    expect(row).toMatchObject({ status: 'CANCELLED', resolvedBy: 'system', confirmedAt: null });
  });

  it('an approval-mode confirm by a contact with 3 live PENDING requests is refused (PortalRequestLimitError, hold released)', async () => {
    const provider = await approvalProvider();
    const starts = await slotStarts(provider);
    const email = newEmail();
    for (let i = 0; i < 3; i++) {
      const token = await book(provider, starts[i]!, { channel: 'EMAIL', email });
      expect((await confirm(token)).body.data.state).toBe('requested');
    }
    const fourth = await book(provider, starts[3]!, { channel: 'EMAIL', email });

    const res = await confirm(fourth);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Request limit reached');
    const rows = await rowsOf(provider.id);
    expect(rows[3]).toMatchObject({ status: 'CANCELLED', resolvedBy: 'system', confirmedAt: null });
    const audits = await prisma.auditLog.findMany({ where: { entityId: rows[3]!.id } });
    expect(audits.some((a) => a.description.includes('no se pudo confirmar'))).toBe(true);
    expect((await view(fourth)).body.data.state).toBe('unavailable');
    expect(rows.filter((r) => r.status === 'PENDING')).toHaveLength(3);
  });

  it('the provider takes the slot of an unconfirmed hold; an auto-confirm click is then refused and the hold released', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!);
    const other = await createTestPatient(provider.id);

    await appointmentService.create({
      startAt: start!, endAt: new Date(new Date(start!).getTime() + 60 * 60_000).toISOString(), price: 0, paid: false,
      status: AppointmentStatus.SCHEDULED, patientId: other.id, locationId: provider.locationId, typeId: provider.typeId,
    }, provider.id);
    const res = await confirm(token);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Slot no longer available');
    expect(await rowOf(provider.id)).toMatchObject({ status: 'CANCELLED', resolvedBy: 'system', confirmedAt: null });
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(1);
    expect(await prisma.patient.count({ where: { userId: provider.id, source: RecordSource.PORTAL } })).toBe(0);
    expect((await view(token)).body.data.state).toBe('unavailable');
  });

  it('approval mode: a click after the provider booked or blocked the time is refused and the hold released', async () => {
    for (const takeSlot of [ 'appointment', 'blocked' ] as const) {
      const provider = await approvalProvider();
      const [ start ] = await slotStarts(provider);
      const token = await book(provider, start!);
      const startAt = new Date(start!);
      const endAt = new Date(startAt.getTime() + 30 * 60_000);
      if (takeSlot === 'appointment') {
        const other = await createTestPatient(provider.id);
        await prisma.appointment.create({
          data: { userId: provider.id, patientId: other.id, startAt, endAt, price: 0, status: AppointmentStatus.CONFIRMED },
        });
      } else {
        await prisma.blockedTime.create({ data: { userId: provider.id, startTimeUtc: startAt, endTimeUtc: endAt } });
      }

      const res = await confirm(token);

      expect({ takeSlot, status: res.status, error: res.body.error }).toEqual({ takeSlot, status: 409, error: 'Slot no longer available' });
      expect(await rowOf(provider.id)).toMatchObject({ status: 'CANCELLED', resolvedBy: 'system', confirmedAt: null });
      expect(mocks.dispatch).not.toHaveBeenCalled();
    }
  });

  it('the slot rules run again at the click: an appointment the provider put within the buffer refuses it, in either mode', async () => {
    for (const mode of [ BookingApprovalMode.AUTO_CONFIRM, BookingApprovalMode.REQUIRE_APPROVAL ]) {
      const provider = await createLiveProvider({ bufferMinutes: 30 });
      await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: mode } });
      const [ start ] = await slotStarts(provider);
      const token = await book(provider, start!);
      const startAt = new Date(start!);
      const other = await createTestPatient(provider.id);
      await prisma.appointment.create({
        data: {
          userId: provider.id, patientId: other.id, startAt: new Date(startAt.getTime() - 60 * 60_000), endAt: startAt,
          price: 0, status: AppointmentStatus.CONFIRMED,
        },
      });

      const res = await confirm(token);

      expect({ mode, status: res.status, error: res.body.error }).toEqual({ mode, status: 409, error: 'Slot no longer available' });
      expect(await rowOf(provider.id)).toMatchObject({ status: 'CANCELLED', resolvedBy: 'system', confirmedAt: null });
      expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(1);
    }
  });

  it("availability removed from the slot's day during the hold refuses the click", async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!);
    const weekday = DateTime.fromISO(start!).setZone(PORTAL_ZONE).weekday;
    await prisma.availabilityRule.deleteMany({ where: { userId: provider.id, weekday } });

    const res = await confirm(token);

    expect(res.status).toBe(409);
    expect(await rowOf(provider.id)).toMatchObject({ status: 'CANCELLED', resolvedBy: 'system' });
  });

  it('the lead time is the one the hold was taken under: a click minutes later still books', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const lead = Math.floor((new Date(start!).getTime() - Date.now()) / 60_000) - 1;
    await prisma.user.update({ where: { id: provider.id }, data: { minLeadMinutes: lead } });
    const token = await book(provider, start!);
    const booked = await rowOf(provider.id);
    vi.useFakeTimers({ toFake: [ 'Date' ] });
    vi.setSystemTime(new Date(booked.createdAt.getTime() + 10 * 60_000));

    const res = await confirm(token);

    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe('confirmed');
  });

  it('concurrent confirms create one appointment', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!);

    const [ a, b ] = await Promise.all([ confirm(token), confirm(token) ]);

    expect([ a.status, b.status ]).toEqual([ 200, 200 ]);
    expect([ a.body.data.state, b.body.data.state ]).toEqual([ 'confirmed', 'confirmed' ]);
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(1);
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(1);
  });

  it('a second confirm answers the confirmed state without side effects', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!);
    await confirm(token);
    const row = await rowOf(provider.id);
    const audits = await prisma.auditLog.count({ where: { userId: provider.id } });
    mocks.dispatch.mockClear();

    const again = await confirm(token);

    expect(again.status).toBe(200);
    expect(again.body.data.state).toBe('confirmed');
    expect(await rowOf(provider.id)).toEqual(row);
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { userId: provider.id } })).toBe(audits);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect((await view(token)).body.data.state).toBe('confirmed');
  });

  it('late click is expired even before the sweep', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!);
    const booked = await rowOf(provider.id);
    vi.useFakeTimers({ toFake: [ 'Date' ] });
    vi.setSystemTime(new Date(booked.holdExpiresAt.getTime() + 1000));

    const res = await confirm(token);

    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe('expired');
    expect((await rowOf(provider.id)).status).toBe('UNCONFIRMED');
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(0);
    expect((await view(token)).body.data.state).toBe('expired');
  });

  it('releases the hold when confirmation is refused', async () => {
    const provider = await createLiveProvider();
    const revoked = await createTestPatient(provider.id, { email: newEmail() });
    await prisma.patient.update({ where: { id: revoked.id }, data: { portalAccessEnabled: false } });
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!, { channel: 'EMAIL', email: revoked.email! });

    const res = await confirm(token);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Online booking unavailable');
    const row = await rowOf(provider.id);
    expect(row).toMatchObject({ status: 'CANCELLED', resolvedBy: 'system', confirmedAt: null });
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
    const audits = await prisma.auditLog.findMany({ where: { entityId: row.id } });
    expect(audits.some((a) => a.description.includes('no se pudo confirmar'))).toBe(true);
    expect((await view(token)).body.data.state).toBe('unavailable');
    await book(provider, start!);
  });

  it('releases the hold when booking is paused between booking and click', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!);
    await prisma.user.update({ where: { id: provider.id }, data: { bookingEnabled: false } });

    const res = await confirm(token);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Provider not found');
    expect(await rowOf(provider.id)).toMatchObject({ status: 'CANCELLED', resolvedBy: 'system' });
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(0);
    expect((await view(token)).body.data.state).toBe('unavailable');
  });

  it('releases the hold when the location is no longer bookable', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!);
    await prisma.appointmentLocation.update({ where: { id: provider.locationId }, data: { bookableOnline: false } });

    expect((await confirm(token)).status).toBe(404);
    expect(await rowOf(provider.id)).toMatchObject({ status: 'CANCELLED', resolvedBy: 'system' });
  });

  it('two confirmations by the same new email create one patient', async () => {
    const provider = await createLiveProvider();
    const [ s1, s2 ] = await slotStarts(provider);
    const email = newEmail();
    const t1 = await book(provider, s1!, { channel: 'EMAIL', email });
    const t2 = await book(provider, s2!, { channel: 'EMAIL', email });

    const [ a, b ] = await Promise.all([ confirm(t1), confirm(t2) ]);

    expect([ a.body.data.state, b.body.data.state ]).toEqual([ 'confirmed', 'confirmed' ]);
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(1);
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(2);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(1);
  });

  it('the cap of 3 upcoming portal bookings applies at confirmation (409 PortalBookingLimitError, hold released)', async () => {
    const provider = await createLiveProvider();
    const starts = await slotStarts(provider);
    const email = newEmail();
    for (let i = 0; i < 3; i++) {
      const token = await book(provider, starts[i]!, { channel: 'EMAIL', email });
      expect((await confirm(token)).body.data.state).toBe('confirmed');
    }
    const fourth = await book(provider, starts[3]!, { channel: 'EMAIL', email });

    const res = await confirm(fourth);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Booking limit reached');
    const rows = await rowsOf(provider.id);
    expect(rows[3]).toMatchObject({ status: 'CANCELLED', resolvedBy: 'system' });
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(3);
  });

  it('the patient confirmation and provider notice are sent after commit (scheduler off)', async () => {
    const provider = await createLiveProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { reminderActive: true, reminderChannel: Channel.EMAIL } });
    const [ start ] = await slotStarts(provider);
    const email = newEmail();
    const token = await book(provider, start!, { channel: 'EMAIL', email });
    const seen: number[] = [];
    mocks.dispatch.mockImplementation(async () => {
      seen.push(await prisma.appointment.count({ where: { userId: provider.id } }));
      return { success: true, messageSid: 'msg-2' };
    });

    await confirm(token);

    expect(mocks.dispatch).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([ 1, 1 ]);
    const recipients = mocks.dispatch.mock.calls.map(([ , opts ]) => opts.to);
    expect(recipients).toContain(email);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('a WhatsApp confirmation proves the number: patient created with whatsappNumber and reminderChannel WHATSAPP', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const token = await book(provider, start!, { channel: 'WHATSAPP', phone: '+573009998877' });

    const res = await confirm(token);

    expect(res.body.data.state).toBe('confirmed');
    const [ patient ] = await prisma.patient.findMany({ where: { userId: provider.id } });
    expect(patient).toMatchObject({
      whatsappNumber: '+573009998877', reminderChannel: Channel.WHATSAPP, whatsappUnverified: false, email: null,
      source: RecordSource.PORTAL,
    });
  });

  it('rejects a body without a token or with extra fields', async () => {
    expect((await request(app).post('/v1/public/booking-confirmations/confirm').send({})).status).toBe(400);
    expect((await request(app).post('/v1/public/booking-confirmations/view').send({ token: 'x', extra: 1 })).status).toBe(400);
  });
});
