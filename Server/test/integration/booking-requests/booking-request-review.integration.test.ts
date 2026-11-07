import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), send: vi.fn(), email: vi.fn() }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: () => ({ send: mocks.send }) }));
vi.mock('../../../src/brevo/transactional.js', () => ({ sendTransactionalEmail: mocks.email }));

import { authenticate, requireAdmin, requireAdminForWrites } from '../../../src/middlewares/authenticate.js';
import { requirePortalEnabled } from '../../../src/middlewares/require-portal-enabled.js';
import { bookingRequestRouter } from '../../../src/booking-requests/booking-request.routes.js';
import { appointmentRouter } from '../../../src/appointments/appointment.routes.js';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import {
  ActionSource,
  AdminRole,
  AppointmentStatus,
  BookingRequestKind,
  BookingRequestStatus,
  Channel,
  ConsentKind,
  EntityType,
  PatientStatus,
  RecordSource,
} from '../../../generated/prisma/enums.js';
import { bookingRequestService } from '../../../src/booking-requests/booking-request.service.js';
import { deliverBookingRequestNotification } from '../../../src/booking-requests/booking-request-notifications.js';
import { PRIVACY_POLICY_VERSION } from '../../../src/portal/privacy-policy.js';
import { createTestPatient, createTestToken, createTestUser, csrfHeaders, unique } from '../helpers.js';
import { createLiveProvider, slotStarts, type LiveProvider } from '../portal/portal-helpers.js';

const portal = config.portal as { patientEnabled: boolean };
const scheduler = config.scheduler as { enabled: boolean };
const was = { portal: portal.patientEnabled, scheduler: scheduler.enabled };
beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = was.portal; scheduler.enabled = was.scheduler; });

beforeEach(() => {
  scheduler.enabled = false;
  mocks.dispatch.mockReset().mockResolvedValue({ success: true, messageSid: 'msg-1' });
  mocks.send.mockReset().mockResolvedValue('job-1');
  mocks.email.mockReset().mockResolvedValue({ sent: true });
});

const HOUR = 3_600_000;

/** The provider mounts from `app.ts`, without its global per-IP limiter (this file sends many requests). */
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/v1/booking-requests', authenticate, requirePortalEnabled, requireAdmin, bookingRequestRouter);
app.use('/v1/appointments', authenticate, requireAdminForWrites, appointmentRouter);

interface Provider extends LiveProvider { email: string; role: string }

async function provider(): Promise<Provider> {
  const live = await createLiveProvider();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: live.id } });
  return { ...live, email: user.email, role: user.role };
}

const bearer = (p: { id: string; email: string; role: string }) => ({ Authorization: `Bearer ${createTestToken(p)}` });

async function seedRequest(p: LiveProvider, opts: { start?: string | undefined; email?: string | undefined; now?: Date | undefined; kind?: BookingRequestKind | undefined } = {}) {
  const start = new Date(opts.start ?? (await slotStarts(p))[ 0 ]!);
  const now = opts.now ?? new Date();
  return prisma.$transaction(async (tx) => (await bookingRequestService.createHoldWithin(tx, p.id, {
    kind: opts.kind ?? BookingRequestKind.NEW,
    email: opts.email ?? unique('solicitud@test.local').toLowerCase(),
    name: 'Lucia',
    lastName: 'Rojas',
    phone: '+573001112233',
    typeId: p.typeId,
    locationId: p.locationId,
    startAt: start,
    endAt: new Date(start.getTime() + HOUR),
    patientTimezone: 'America/New_York',
    policyVersion: PRIVACY_POLICY_VERSION,
    consentAcceptedAt: new Date(now.getTime() - 5 * 60_000),
    consentIp: '203.0.113.9',
    consentUserAgent: 'test-agent',
  }, now)).request);
}

const api = '/v1/booking-requests';
const approve = (p: Provider, id: string, body?: object) => request(app).post(`${api}/${id}/approve`).set(bearer(p)).send(body ?? {});
const reject = (p: Provider, id: string) => request(app).post(`${api}/${id}/reject`).set(bearer(p)).send({});

describe('GET /v1/booking-requests', () => {
  it('lists each tab by effective status and counts only live pending requests', async () => {
    const p = await provider();
    const starts = await slotStarts(p);
    const live = await seedRequest(p, { start: starts[ 0 ] });
    const stale = await seedRequest(p, { start: starts[ 1 ] });
    await prisma.bookingRequest.update({ where: { id: stale.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    const rejected = await seedRequest(p, { start: starts[ 2 ] });
    await reject(p, rejected.id);

    const tab = async (status: string) => (await request(app).get(`${api}?status=${status}`).set(bearer(p))).body.data;
    const pending = await tab('pending');
    expect(pending.data.map((r: { id: string }) => r.id)).toEqual([ live.id ]);
    expect(pending.data[ 0 ]).toMatchObject({ name: 'Lucia', lastName: 'Rojas', status: 'PENDING', type: { id: p.typeId } });
    const expired = await tab('expired');
    expect(expired.data.map((r: { id: string; status: string }) => [ r.id, r.status ])).toEqual([ [ stale.id, 'EXPIRED' ] ]);
    expect((await tab('resolved')).data.map((r: { id: string }) => r.id)).toEqual([ rejected.id ]);

    const count = await request(app).get(`${api}/count`).set(bearer(p));
    expect(count.body.data).toEqual({ pending: 1 });
  });

  it('filters by start range for the calendar', async () => {
    const p = await provider();
    const starts = await slotStarts(p);
    const first = await seedRequest(p, { start: starts[ 0 ] });
    await seedRequest(p, { start: starts[ 3 ] });
    const res = await request(app).get(api).query({ status: 'pending', from: starts[ 0 ], to: starts[ 1 ] }).set(bearer(p));
    expect(res.body.data.data.map((r: { id: string }) => r.id)).toEqual([ first.id ]);
  });

  it('is admin-only, tenant-scoped and hidden while the portal is off', async () => {
    const p = await provider();
    const req = await seedRequest(p);
    const viewer = await createTestUser({ role: AdminRole.VIEWER });
    expect((await request(app).get(api).set(bearer(viewer))).status).toBe(403);

    const other = await createTestUser();
    expect((await request(app).get(`${api}/${req.id}`).set(bearer(other))).status).toBe(404);
    expect((await approve(other as unknown as Provider, req.id)).status).toBe(404);
    expect((await request(app).get(api).set(bearer(other))).body.data.data).toEqual([]);

    portal.patientEnabled = false;
    try {
      expect((await request(app).get(api).set(bearer(p))).status).toBe(404);
    } finally {
      portal.patientEnabled = true;
    }
  });

  it('requires CSRF on cookie-authenticated writes', async () => {
    const p = await provider();
    const req = await seedRequest(p);
    const cookie = `token=${createTestToken(p)}`;
    expect((await request(app).post(`${api}/${req.id}/reject`).set('Cookie', cookie).send({})).status).toBe(403);
    const ok = await request(app).post(`${api}/${req.id}/reject`).set('Cookie', cookie).set(csrfHeaders()).send({});
    expect(ok.status).toBe(200);
  });
});

describe('GET /v1/booking-requests/:id', () => {
  it('lists the active record first, then deleted ones, computed at view time', async () => {
    const p = await provider();
    const email = unique('candidato@test.local').toLowerCase();
    const deleted = await createTestPatient(p.id, { email });
    await prisma.patient.update({ where: { id: deleted.id }, data: { isDeleted: true, deletedAt: new Date() } });
    const req = await seedRequest(p, { email });

    let detail = (await request(app).get(`${api}/${req.id}`).set(bearer(p))).body.data;
    expect(detail.candidates.map((c: { id: string; isDeleted: boolean }) => [ c.id, c.isDeleted ])).toEqual([ [ deleted.id, true ] ]);
    expect(detail.consent.policyVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(detail).not.toHaveProperty('consentIp');
    expect(detail).not.toHaveProperty('emailHash');

    const active = await createTestPatient(p.id, { email });
    detail = (await request(app).get(`${api}/${req.id}`).set(bearer(p))).body.data;
    expect(detail.candidates.map((c: { id: string }) => c.id)).toEqual([ active.id, deleted.id ]);
  });
});

describe('POST /v1/booking-requests/:id/approve', () => {
  it('refuses to restore a consent revoked after the request was made', async () => {
    const p = await provider();
    const email = unique('revocada@test.local').toLowerCase();
    const patient = await createTestPatient(p.id, { email });
    const consent = await prisma.patientConsent.create({
      data: { patientId: patient.id, userId: p.id, kind: ConsentKind.DATA_PROCESSING, policyVersion: PRIVACY_POLICY_VERSION, acceptedAt: new Date(Date.now() - HOUR) },
    });
    const { id } = await seedRequest(p, { email });
    await prisma.patientConsent.update({ where: { id: consent.id }, data: { revokedAt: new Date() } });

    const res = await approve(p, id);

    expect(res.status).toBe(409);
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id } })).status).toBe(BookingRequestStatus.PENDING);
    expect(await prisma.patientConsent.count({ where: { patientId: patient.id, revokedAt: null } })).toBe(0);
    expect(await prisma.appointment.count({ where: { patientId: patient.id } })).toBe(0);
  });

  it('creates patient, consent (original time) and appointment atomically, then confirms the patient', async () => {
    const p = await provider();
    const req = await seedRequest(p);

    const res = await approve(p, req.id);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'APPROVED' });
    const stored = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(stored.status).toBe(BookingRequestStatus.APPROVED);
    expect(stored.resolvedBy).toBe(p.id);

    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: stored.patientId! } });
    expect(patient).toMatchObject({ email: req.email, name: 'Lucia', lastName: 'Rojas', whatsappNumber: '+573001112233', source: RecordSource.PORTAL });
    const consent = await prisma.patientConsent.findFirstOrThrow({ where: { patientId: patient.id } });
    expect(consent).toMatchObject({ kind: ConsentKind.DATA_PROCESSING, ipAddress: '203.0.113.9', userAgent: 'test-agent' });
    expect(consent.acceptedAt.getTime()).toBe(req.consentAcceptedAt.getTime());

    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: stored.appointmentId! }, include: { reminder: true } });
    expect(appt).toMatchObject({
      status: AppointmentStatus.CONFIRMED, source: RecordSource.PORTAL, patientTimezone: 'America/New_York', price: 120000,
    });
    expect(appt.startAt.getTime()).toBe(req.startAt.getTime());
    expect(appt.reminder).toMatchObject({ channel: Channel.EMAIL, to: req.email });

    const audits = await prisma.auditLog.findMany({ where: { entityType: EntityType.BOOKING_REQUEST, entityId: req.id }, orderBy: { eventTimeUtc: 'asc' } });
    expect(audits.map((a) => a.description)).toEqual([ 'Solicitud de reserva creada desde el portal', 'Solicitud de reserva aprobada' ]);
    expect(audits[ 1 ]!.source).toBe(ActionSource.API);
    expect(JSON.stringify(audits)).not.toContain(req.email);

    // Scheduler off: only the patient confirmation, sent after commit.
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    const [ channel, opts ] = mocks.dispatch.mock.calls[ 0 ]!;
    expect(channel).toBe(Channel.EMAIL);
    expect(opts.to).toBe(req.email);
    expect(opts.subject).toContain('Cita confirmada');
  });

  it('enqueues the patient confirmation on the transaction when the scheduler is on', async () => {
    scheduler.enabled = true;
    const p = await provider();
    const req = await seedRequest(p);
    mocks.send.mockClear();
    await approve(p, req.id);
    const queues = mocks.send.mock.calls.map((c) => [ c[ 0 ], c[ 1 ].kind ]);
    expect(queues).toContainEqual([ 'portal-booking-notify', 'patient-confirmation' ]);
    expect(queues).not.toContainEqual([ 'portal-booking-notify', 'provider-notice' ]);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('reuses an active patient untouched and reactivates an inactive one', async () => {
    const p = await provider();
    const starts = await slotStarts(p);
    const active = await createTestPatient(p.id, { name: 'Original' });
    const inactive = await createTestPatient(p.id);
    await prisma.patient.update({ where: { id: inactive.id }, data: { status: PatientStatus.INACTIVE } });

    const r1 = await seedRequest(p, { start: starts[ 0 ], email: active.email! });
    const r2 = await seedRequest(p, { start: starts[ 1 ], email: inactive.email!, kind: BookingRequestKind.REVIEW });
    expect((await approve(p, r1.id)).status).toBe(200);
    expect((await approve(p, r2.id)).status).toBe(200);

    expect(await prisma.patient.findUniqueOrThrow({ where: { id: active.id } })).toMatchObject({ name: 'Original', lastName: 'Garcia' });
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: inactive.id } })).status).toBe(PatientStatus.ACTIVE);
    expect(await prisma.patient.count({ where: { userId: p.id } })).toBe(2);
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: r2.id } })).patientId).toBe(inactive.id);
  });

  it('restores a chosen deleted patient, or creates a new one beside it', async () => {
    const p = await provider();
    const starts = await slotStarts(p);
    const email = unique('borrado@test.local').toLowerCase();
    const deleted = await createTestPatient(p.id, { email });
    await prisma.patient.update({ where: { id: deleted.id }, data: { isDeleted: true, deletedAt: new Date() } });

    const first = await seedRequest(p, { start: starts[ 0 ], email, kind: BookingRequestKind.REVIEW });
    const created = await approve(p, first.id);
    expect(created.status).toBe(200);
    const newId = (await prisma.bookingRequest.findUniqueOrThrow({ where: { id: first.id } })).patientId;
    expect(newId).not.toBe(deleted.id);
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: deleted.id } })).isDeleted).toBe(true);

    // Now an active record holds the email: restoring the deleted twin collides.
    const second = await seedRequest(p, { start: starts[ 1 ], email, kind: BookingRequestKind.REVIEW });
    const collision = await approve(p, second.id, { restorePatientId: deleted.id });
    expect(collision.status).toBe(409);
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: second.id } })).status).toBe(BookingRequestStatus.PENDING);

    await prisma.patient.update({ where: { id: newId! }, data: { isDeleted: true, deletedAt: new Date() } });
    const restored = await approve(p, second.id, { restorePatientId: deleted.id });
    expect(restored.status).toBe(200);
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: deleted.id } })).isDeleted).toBe(false);
    const restoreAudit = await prisma.auditLog.findFirst({ where: { entityId: deleted.id, actionType: 'RESTORE' } });
    expect(restoreAudit).not.toBeNull();
  });

  it('refuses to restore a patient that is not a candidate of the request', async () => {
    const p = await provider();
    const stranger = await createTestPatient(p.id);
    await prisma.patient.update({ where: { id: stranger.id }, data: { isDeleted: true, deletedAt: new Date() } });
    const req = await seedRequest(p);
    const res = await approve(p, req.id, { restorePatientId: stranger.id });
    expect(res.status).toBe(404);
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: stranger.id } })).isDeleted).toBe(true);
  });

  it('answers 409 for a resolved or clock-expired request', async () => {
    const p = await provider();
    const starts = await slotStarts(p);
    const done = await seedRequest(p, { start: starts[ 0 ] });
    await reject(p, done.id);
    expect((await approve(p, done.id)).status).toBe(409);

    const stale = await seedRequest(p, { start: starts[ 1 ] });
    await prisma.bookingRequest.update({ where: { id: stale.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    const res = await approve(p, stale.id);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Booking request is no longer pending');
  });

  it('rolls back everything and stays PENDING when the slot is taken', async () => {
    const p = await provider();
    const req = await seedRequest(p);
    // Bypass the hold check: an appointment written straight to the table over the held slot.
    const other = await createTestPatient(p.id);
    await prisma.appointment.create({
      data: {
        userId: p.id, patientId: other.id, locationId: p.locationId, typeId: p.typeId,
        startAt: req.startAt, endAt: req.endAt, price: 0, status: AppointmentStatus.CONFIRMED,
      },
    });

    const res = await approve(p, req.id);
    expect(res.status).toBe(409);
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe(BookingRequestStatus.PENDING);
    expect(await prisma.patient.count({ where: { userId: p.id } })).toBe(1);
    expect(await prisma.patientConsent.count({ where: { userId: p.id } })).toBe(0);
    expect(await prisma.appointment.count({ where: { userId: p.id } })).toBe(1);
  });

  it('lets exactly one of approve and a provider-created appointment win the slot', async () => {
    const p = await provider();
    const req = await seedRequest(p);
    const other = await createTestPatient(p.id);
    const results = await Promise.all([
      approve(p, req.id),
      request(app).post('/v1/appointments').set(bearer(p)).send({
        startAt: req.startAt.toISOString(), endAt: req.endAt.toISOString(), price: 0, paid: false,
        status: AppointmentStatus.SCHEDULED, patientId: other.id, locationId: p.locationId, typeId: p.typeId,
      }),
    ]);
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);
    expect(await prisma.appointment.count({ where: { userId: p.id, isDeleted: false } })).toBe(1);
  });
});

describe('POST /v1/booking-requests/:id/reject', () => {
  it('releases the slot, audits and emails the patient a neutral notice', async () => {
    const p = await provider();
    const req = await seedRequest(p);

    const res = await reject(p, req.id);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    const hold = await prisma.bookingRequest.count({ where: { userId: p.id, status: BookingRequestStatus.PENDING } });
    expect(hold).toBe(0);
    expect(await prisma.patient.count({ where: { userId: p.id } })).toBe(0);
    const [ channel, opts ] = mocks.dispatch.mock.calls[ 0 ]!;
    expect(channel).toBe(Channel.EMAIL);
    expect(opts.to).toBe(req.email);
    expect(opts.subject).toContain('no fue confirmada');
    expect(opts.body).toContain(`/book/${p.slug}`);
    expect(opts.body).not.toMatch(/motivo|razón/i);

    // The slot can be booked again.
    expect((await slotStarts(p))).toContain(req.startAt.toISOString());
  });
});

describe('booking-request-notify', () => {
  it('sends the provider a notice without patient details on their reminder channel', async () => {
    const p = await provider();
    await prisma.user.update({ where: { id: p.id }, data: { reminderActive: true, reminderChannel: Channel.EMAIL } });
    const req = await seedRequest(p);
    mocks.dispatch.mockClear();

    await deliverBookingRequestNotification({ requestId: req.id, event: 'received' });

    const [ channel, opts ] = mocks.dispatch.mock.calls[ 0 ]!;
    expect(channel).toBe(Channel.EMAIL);
    expect(opts.to).toBe(p.email);
    expect(opts.subject).toBe('Nueva solicitud de cita en línea');
    expect(opts.body).toContain('/requests');
    expect(opts.body).not.toContain('Lucia');
    expect(opts.body).not.toContain(req.email);
  });

  it('uses the request template on WhatsApp, and a separate nudge template that says when the slot is released', async () => {
    const p = await provider();
    await prisma.user.update({ where: { id: p.id }, data: { reminderActive: true, reminderChannel: Channel.WHATSAPP, whatsappNumber: '+573009998877' } });
    const req = await seedRequest(p);
    mocks.dispatch.mockClear();
    await deliverBookingRequestNotification({ requestId: req.id, event: 'received' });
    await deliverBookingRequestNotification({ requestId: req.id, event: 'nudge' });

    const [ receivedChannel, received ] = mocks.dispatch.mock.calls[ 0 ]!;
    const [ nudgeChannel, nudge ] = mocks.dispatch.mock.calls[ 1 ]!;
    expect(receivedChannel).toBe(Channel.WHATSAPP);
    expect(received.contentSid).toBe(config.twilio.portalRequestSid);
    expect(Object.keys(received.contentVariables)).toEqual([ '1', '2', '3' ]);
    expect(nudgeChannel).toBe(Channel.WHATSAPP);
    expect(nudge.contentSid).toBe(config.twilio.portalRequestNudgeSid);
    expect(nudge.contentSid).not.toBe(config.twilio.portalRequestSid);
    expect(Object.keys(nudge.contentVariables)).toEqual([ '1', '2', '3', '4' ]);
  });

  it('links the provider to /requests without a double slash when PORTAL_URL ends in one', async () => {
    const p = await provider();
    await prisma.user.update({ where: { id: p.id }, data: { reminderActive: true, reminderChannel: Channel.EMAIL } });
    const req = await seedRequest(p);
    const portalConfig = config.portal as { url: string };
    const urlWas = portalConfig.url;
    portalConfig.url = 'https://app.example.com/';
    try {
      mocks.dispatch.mockClear();
      await deliverBookingRequestNotification({ requestId: req.id, event: 'received' });
    } finally {
      portalConfig.url = urlWas;
    }
    const [ , opts ] = mocks.dispatch.mock.calls[ 0 ]!;
    expect(opts.body).toContain('https://app.example.com/requests');
    expect(opts.body).not.toContain('//requests');
  });

  it('skips stale jobs and throws on failed sends so pg-boss retries', async () => {
    const p = await provider();
    await prisma.user.update({ where: { id: p.id }, data: { reminderActive: true, reminderChannel: Channel.EMAIL } });
    const req = await seedRequest(p);
    await deliverBookingRequestNotification({ requestId: req.id, event: 'rejected' });
    expect(mocks.dispatch).not.toHaveBeenCalled();

    mocks.dispatch.mockResolvedValueOnce({ success: false, error: 'down' });
    await expect(deliverBookingRequestNotification({ requestId: req.id, event: 'received' })).rejects.toThrow(/failed/);

    expect((await reject(p, req.id)).status).toBe(200);
    mocks.dispatch.mockClear();
    await deliverBookingRequestNotification({ requestId: req.id, event: 'nudge' });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('enqueues the provider notice with the hold, on the same transaction', async () => {
    scheduler.enabled = true;
    const p = await provider();
    const req = await seedRequest(p);
    expect(mocks.send).toHaveBeenCalledWith('booking-request-notify', { requestId: req.id, event: 'received' }, expect.anything());
  });
});

describe('sweep-booking-requests', () => {
  it('expires stale holds with audit and a patient email job, and nudges once past half the hold', async () => {
    scheduler.enabled = true;
    const p = await provider();
    const starts = await slotStarts(p, 5);
    const created = new Date(Date.now() - 30 * HOUR);
    const due = await seedRequest(p, { start: starts[ 0 ], now: created });
    const fresh = await seedRequest(p, { start: starts[ 1 ] });
    const stale = await seedRequest(p, { start: starts[ 2 ] });
    await prisma.bookingRequest.update({ where: { id: stale.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    await prisma.bookingRequest.update({ where: { id: due.id }, data: { createdAt: created } });
    mocks.send.mockClear();

    expect(await bookingRequestService.sweep()).toEqual({ expired: 1, nudged: 1 });
    expect(await bookingRequestService.sweep()).toEqual({ expired: 0, nudged: 0 });

    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe(BookingRequestStatus.EXPIRED);
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: due.id } })).nudgedAt).not.toBeNull();
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: fresh.id } })).nudgedAt).toBeNull();
    const jobs = mocks.send.mock.calls.filter((c) => c[ 0 ] === 'booking-request-notify').map((c) => c[ 1 ]);
    expect(jobs).toEqual([ { requestId: stale.id, event: 'expired' }, { requestId: due.id, event: 'nudge' } ]);
    const audits = await prisma.auditLog.findMany({ where: { entityType: EntityType.BOOKING_REQUEST, entityId: stale.id } });
    expect(audits.find((a) => a.description === 'Solicitud de reserva vencida')?.source).toBe(ActionSource.JOB);
  });

  it('emails the patient when a request expires', async () => {
    const p = await provider();
    const req = await seedRequest(p);
    await prisma.bookingRequest.update({ where: { id: req.id }, data: { status: BookingRequestStatus.EXPIRED } });
    await deliverBookingRequestNotification({ requestId: req.id, event: 'expired' });
    const [ , opts ] = mocks.dispatch.mock.calls[ 0 ]!;
    expect(opts.to).toBe(req.email);
    expect(opts.subject).toContain('venció');
  });

  it('purges resolved requests after the retention period, never pending ones', async () => {
    const p = await provider();
    const starts = await slotStarts(p);
    const old = await seedRequest(p, { start: starts[ 0 ] });
    const pending = await seedRequest(p, { start: starts[ 1 ] });
    expect((await reject(p, old.id)).status).toBe(200);
    const longAgo = new Date(Date.now() - 91 * 24 * HOUR);
    await prisma.$executeRaw`UPDATE booking_requests SET "updatedAt" = ${longAgo} WHERE id IN (${old.id}::uuid, ${pending.id}::uuid)`;

    expect(await bookingRequestService.purgeResolved()).toBe(1);
    expect(await prisma.bookingRequest.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.bookingRequest.findUnique({ where: { id: pending.id } })).not.toBeNull();
  });
});
