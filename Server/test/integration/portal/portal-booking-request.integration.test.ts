import type express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), send: vi.fn(), email: vi.fn() }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: () => ({ send: mocks.send }) }));
vi.mock('../../../src/brevo/transactional.js', () => ({ sendTransactionalEmail: mocks.email }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { emailHash } from '../../../src/utils/encryption/blind-index.js';
import { BookingApprovalMode, BookingRequestStatus, EntityType, ActionSource } from '../../../generated/prisma/enums.js';
import {
  MAX_PENDING_REQUESTS_PER_EMAIL,
  MAX_PENDING_REQUESTS_PER_PROVIDER,
} from '../../../src/booking-requests/booking-request.constants.js';
import { createTestPatient, unique } from '../helpers.js';
import {
  ALLOWED_ORIGIN, buildPortalApp, createConsentedPatient, createLiveProvider, portalBookingBody, portalPost, sessionFor, slotStarts,
  type LiveProvider, type TestSession,
} from './portal-helpers.js';

let app: express.Express;
const portal = config.portal as { patientEnabled: boolean };
const portalWas = portal.patientEnabled;
beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = portalWas; });
const scheduler = config.scheduler as { enabled: boolean };
const schedulerWas = scheduler.enabled;
afterAll(() => { scheduler.enabled = schedulerWas; });

beforeEach(() => {
  app = buildPortalApp();
  scheduler.enabled = false;
  mocks.dispatch.mockReset().mockResolvedValue({ success: true, messageSid: 'msg-1' });
  mocks.send.mockReset().mockResolvedValue('job-1');
  mocks.email.mockReset().mockResolvedValue({ sent: true });
});

const approvalProvider = async (): Promise<LiveProvider> => {
  const provider = await createLiveProvider();
  await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });
  return provider;
};

const postBooking = (s: TestSession, body: unknown) => portalPost(app, '/v1/portal/bookings', s, body as object);
const getAppointments = (s: TestSession) => request(app).get('/v1/portal/appointments').set('Cookie', s.cookie);
const cancelRequest = (s: TestSession, id: string, opts: { csrf?: string | null } = {}) =>
  portalPost(app, `/v1/portal/requests/${id}/cancel`, s, undefined, opts);

describe('POST /v1/portal/bookings in approval mode', () => {
  it('answers 202 with a request, holds the slot and creates no patient, consent or appointment', async () => {
    const provider = await approvalProvider();
    const email = unique('solicita@test.local');
    const [ start ] = await slotStarts(provider);

    const res = await postBooking(sessionFor(provider.id, email), portalBookingBody(provider, start!));

    expect(res.status).toBe(202);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(Object.keys(res.body.data)).toEqual([ 'request' ]);
    const dto = res.body.data.request;
    expect(Object.keys(dto).sort()).toEqual([
      'durationMinutes', 'endUtc', 'holdExpiresAt', 'id', 'location', 'startUtc', 'status', 'type',
    ]);
    expect(dto).toMatchObject({ startUtc: start, durationMinutes: 60, status: 'PENDING' });
    expect(Object.keys(dto.type)).toEqual([ 'name' ]);
    expect(Object.keys(dto.location).sort()).toEqual([ 'address', 'isVirtual', 'name' ]);

    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(0);

    const stored = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: dto.id } });
    expect(stored).toMatchObject({
      status: BookingRequestStatus.PENDING,
      email,
      name: 'Lucia',
      lastName: 'Rojas',
      phone: '+573001112233',
      emailHash: emailHash(email),
      patientTimezone: 'America/New_York',
      typeId: provider.typeId,
      locationId: provider.locationId,
    });
    expect(stored.consentAcceptedAt).toBeInstanceOf(Date);
    expect(stored.policyVersion).toBeTruthy();

    const audits = await prisma.auditLog.findMany({ where: { entityType: EntityType.BOOKING_REQUEST, entityId: dto.id } });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.source).toBe(ActionSource.PUBLIC_PORTAL);
    expect(JSON.stringify(audits[0])).not.toContain(email);
  });

  it('emails the patient that the request was received, without a date or contact data from other patients', async () => {
    const provider = await approvalProvider();
    const email = unique('correo@test.local');
    const [ start ] = await slotStarts(provider);

    await postBooking(sessionFor(provider.id, email), portalBookingBody(provider, start!));

    expect(mocks.email).toHaveBeenCalledTimes(1);
    const [ to, rendered ] = mocks.email.mock.calls[0]!;
    expect(to).toBe(email);
    expect(rendered.subject).toContain('Recibimos tu solicitud');
    expect(rendered.body).toContain(`/book/${provider.slug}/appointments`);
  });

  it('gives the same answer shape for a new email, a matching patient and a revoked patient', async () => {
    const provider = await approvalProvider();
    const consented = await createConsentedPatient(provider.id);
    const revoked = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: revoked.id }, data: { portalAccessEnabled: false } });
    const starts = await slotStarts(provider);

    const emails = [ unique('nueva@test.local'), consented.email!, revoked.email! ];
    const shapes = [];
    for (const [ i, email ] of emails.entries()) {
      const res = await postBooking(sessionFor(provider.id, email), portalBookingBody(provider, starts[i]!));
      shapes.push({ status: res.status, keys: Object.keys(res.body.data), dto: Object.keys(res.body.data.request).sort() });
    }
    expect(new Set(shapes.map((s) => JSON.stringify(s))).size).toBe(1);
    expect(shapes[0]!.status).toBe(202);
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(2);
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(0);
  });

  it('blocks the slot for the next patient with the neutral 409', async () => {
    const provider = await approvalProvider();
    const [ start ] = await slotStarts(provider);

    expect((await postBooking(sessionFor(provider.id, unique('a@test.local')), portalBookingBody(provider, start!))).status).toBe(202);
    const second = await postBooking(sessionFor(provider.id, unique('b@test.local')), portalBookingBody(provider, start!));

    expect(second.status).toBe(409);
    expect(second.body.error).toBe('Slot no longer available');
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id } })).toBe(1);
  });

  it('caps pending requests per email', async () => {
    const provider = await approvalProvider();
    const starts = await slotStarts(provider);
    const session = sessionFor(provider.id, unique('muchas@test.local'));

    for (let i = 0; i < MAX_PENDING_REQUESTS_PER_EMAIL; i++) {
      expect((await postBooking(session, portalBookingBody(provider, starts[i]!))).status).toBe(202);
    }
    const over = await postBooking(session, portalBookingBody(provider, starts[MAX_PENDING_REQUESTS_PER_EMAIL]!));
    expect(over.status).toBe(409);
    expect(over.body.error).toBe('Request limit reached');
    expect((await postBooking(sessionFor(provider.id, unique('otra@test.local')), portalBookingBody(provider, starts[5]!))).status).toBe(202);
  });

  it('still answers 202 when the receipt email fails after commit', async () => {
    const provider = await approvalProvider();
    const [ start ] = await slotStarts(provider);
    mocks.email.mockRejectedValueOnce(new Error('pool timeout'));

    const res = await postBooking(sessionFor(provider.id, unique('correo@test.local')), portalBookingBody(provider, start!));

    expect(res.status).toBe(202);
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id, status: BookingRequestStatus.PENDING } })).toBe(1);
  });

  it('caps live requests per provider with an error that says nothing about this patient', async () => {
    const provider = await approvalProvider();
    const [ start ] = await slotStarts(provider);
    const base = Date.now() - 400 * 24 * 3_600_000;
    for (let i = 0; i < MAX_PENDING_REQUESTS_PER_PROVIDER; i++) {
      await prisma.bookingRequest.create({
        data: {
          userId: provider.id,
          email: `lleno${i}@test.local`,
          name: 'Otra',
          lastName: 'Persona',
          typeId: provider.typeId,
          locationId: provider.locationId,
          startAt: new Date(base + i * 3_600_000),
          endAt: new Date(base + (i + 1) * 3_600_000),
          patientTimezone: 'America/Bogota',
          holdExpiresAt: new Date(Date.now() + 3_600_000),
          policyVersion: 'test',
          consentAcceptedAt: new Date(),
        },
      });
    }

    const res = await postBooking(sessionFor(provider.id, unique('nueva@test.local')), portalBookingBody(provider, start!));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Request capacity reached');
  });

  it('rejects a start off the grid and an unknown type like the auto flow', async () => {
    const provider = await approvalProvider();
    const [ start ] = await slotStarts(provider);
    const session = sessionFor(provider.id, unique('malo@test.local'));
    const offGrid = new Date(new Date(start!).getTime() + 7 * 60_000).toISOString();

    expect((await postBooking(session, portalBookingBody(provider, offGrid))).status).toBe(409);
    expect((await postBooking(session, portalBookingBody(provider, start!, { typeId: '11111111-1111-4111-8111-111111111111' }))).status).toBe(404);
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id } })).toBe(0);
  });

  it('stays a 404 when booking is not live', async () => {
    const provider = await approvalProvider();
    const [ start ] = await slotStarts(provider);
    await prisma.user.update({ where: { id: provider.id }, data: { bookingEnabled: false } });

    const res = await postBooking(sessionFor(provider.id, unique('cerrada@test.local')), portalBookingBody(provider, start!));
    expect(res.status).toBe(404);
  });

  it('still books straight away for a provider in auto-confirm mode', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const res = await postBooking(sessionFor(provider.id, unique('auto@test.local')), portalBookingBody(provider, start!));
    expect(res.status).toBe(201);
    expect(Object.keys(res.body.data)).toEqual([ 'appointment' ]);
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id } })).toBe(0);
  });
});

describe('GET /v1/portal/appointments pending requests', () => {
  it('lists only the session email\'s live pending requests, even without a patient or consent', async () => {
    const provider = await approvalProvider();
    const other = await approvalProvider();
    const email = unique('lista@test.local');
    const starts = await slotStarts(provider);
    const [ otherStart ] = await slotStarts(other);
    const session = sessionFor(provider.id, email);

    const second = await postBooking(session, portalBookingBody(provider, starts[3]!));
    const first = await postBooking(session, portalBookingBody(provider, starts[1]!));
    await postBooking(sessionFor(provider.id, unique('ajena@test.local')), portalBookingBody(provider, starts[5]!));
    await postBooking(sessionFor(other.id, email), portalBookingBody(other, otherStart!));

    const res = await getAppointments(session);
    expect(res.status).toBe(200);
    expect(res.body.data.consentRequired).toBe(true);
    expect(res.body.data.appointments).toEqual([]);
    expect(res.body.data.requests.map((r: { id: string }) => r.id)).toEqual([ first.body.data.request.id, second.body.data.request.id ]);
  });

  it('hides expired, cancelled and other states', async () => {
    const provider = await approvalProvider();
    const session = sessionFor(provider.id, unique('estados@test.local'));
    const starts = await slotStarts(provider);
    const a = await postBooking(session, portalBookingBody(provider, starts[1]!));
    const b = await postBooking(session, portalBookingBody(provider, starts[2]!));
    await prisma.bookingRequest.update({ where: { id: a.body.data.request.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    await prisma.bookingRequest.update({ where: { id: b.body.data.request.id }, data: { status: BookingRequestStatus.REJECTED } });

    expect((await getAppointments(session)).body.data.requests).toEqual([]);
  });
});

describe('POST /v1/portal/requests/:id/cancel', () => {
  it('cancels the patient\'s own request, releases the slot and audits', async () => {
    const provider = await approvalProvider();
    const session = sessionFor(provider.id, unique('cancela@test.local'));
    const [ start ] = await slotStarts(provider);
    const created = await postBooking(session, portalBookingBody(provider, start!));
    const id = created.body.data.request.id as string;

    const res = await cancelRequest(session, id);
    expect(res.status).toBe(204);

    const stored = await prisma.bookingRequest.findUniqueOrThrow({ where: { id } });
    expect(stored.status).toBe(BookingRequestStatus.CANCELLED);
    expect(stored.resolvedAt).not.toBeNull();
    expect(await slotStarts(provider)).toContain(start);
    expect((await getAppointments(session)).body.data.requests).toEqual([]);

    const audits = await prisma.auditLog.findMany({ where: { entityType: EntityType.BOOKING_REQUEST, entityId: id } });
    expect(audits.map((a) => a.description)).toContain('Solicitud de reserva cancelada por el paciente desde el portal');
    expect((await postBooking(sessionFor(provider.id, unique('otro@test.local')), portalBookingBody(provider, start!))).status).toBe(202);
  });

  it('answers the same 404 for someone else\'s, another provider\'s, resolved, expired and unknown requests', async () => {
    const provider = await approvalProvider();
    const other = await approvalProvider();
    const owner = sessionFor(provider.id, unique('duena@test.local'));
    const starts = await slotStarts(provider);
    const mine = (await postBooking(owner, portalBookingBody(provider, starts[1]!))).body.data.request.id as string;
    const resolved = (await postBooking(owner, portalBookingBody(provider, starts[2]!))).body.data.request.id as string;
    const expired = (await postBooking(owner, portalBookingBody(provider, starts[3]!))).body.data.request.id as string;
    await prisma.bookingRequest.update({ where: { id: resolved }, data: { status: BookingRequestStatus.APPROVED } });
    await prisma.bookingRequest.update({ where: { id: expired }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });

    const intruder = sessionFor(provider.id, unique('intrusa@test.local'));
    const otherTenant = sessionFor(other.id, owner.email);
    const attempts = [
      await cancelRequest(intruder, mine),
      await cancelRequest(otherTenant, mine),
      await cancelRequest(owner, resolved),
      await cancelRequest(owner, expired),
      await cancelRequest(owner, '11111111-1111-4111-8111-111111111111'),
    ];
    for (const res of attempts) {
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Request not found');
    }
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: mine } })).status).toBe(BookingRequestStatus.PENDING);
  });

  it('needs the session, the CSRF header and the exact Origin', async () => {
    const provider = await approvalProvider();
    const session = sessionFor(provider.id, unique('guarda@test.local'));
    const [ start ] = await slotStarts(provider);
    const id = (await postBooking(session, portalBookingBody(provider, start!))).body.data.request.id as string;

    expect((await cancelRequest(session, id, { csrf: null })).status).toBe(403);
    expect((await request(app).post(`/v1/portal/requests/${id}/cancel`).set('Origin', ALLOWED_ORIGIN).send()).status).toBe(401);
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id } })).status).toBe(BookingRequestStatus.PENDING);
  });

  it('still cancels while booking is paused', async () => {
    const provider = await approvalProvider();
    const session = sessionFor(provider.id, unique('pausa@test.local'));
    const [ start ] = await slotStarts(provider);
    const id = (await postBooking(session, portalBookingBody(provider, start!))).body.data.request.id as string;
    await prisma.user.update({ where: { id: provider.id }, data: { bookingEnabled: false } });

    expect((await cancelRequest(session, id)).status).toBe(204);
  });
});

describe('reschedule in approval mode', () => {
  it('is unavailable: the slots and move endpoints answer as an unknown provider', async () => {
    const provider = await createLiveProvider();
    const session = sessionFor(provider.id, unique('mueve@test.local'));
    const [ start, later ] = await slotStarts(provider);
    const booked = await postBooking(session, portalBookingBody(provider, start!));
    const appointmentId = booked.body.data.appointment.id as string;
    await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });

    const res = await portalPost(app, `/v1/portal/appointments/${appointmentId}/reschedule`, session, { startUtc: later, patientTimezone: 'America/Bogota' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Provider not found');
    expect((await portalPost(app, `/v1/portal/appointments/${appointmentId}/cancel`, session)).status).toBe(204);
  });
});
