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
import { bookingRequestService } from '../../../src/booking-requests/booking-request.service.js';
import { withProviderLock } from '../../../src/utils/prisma/provider-lock.js';
import { unique } from '../helpers.js';
import {
  ALLOWED_ORIGIN, bookViaConfirmation, buildPortalApp, createLiveProvider, portalPost, sessionFor, slotStarts,
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

const getAppointments = (s: TestSession) => request(app).get('/v1/portal/appointments').set('Cookie', s.cookie);
const cancelRequest = (s: TestSession, id: string, opts: { csrf?: string | null } = {}) =>
  portalPost(app, `/v1/portal/requests/${id}/cancel`, s, undefined, opts);

describe('an approval-mode booking confirmed through its link', () => {
  it('lands as a PENDING request and creates no patient, consent or appointment', async () => {
    const provider = await approvalProvider();
    const email = unique('solicita@test.local');
    const [ start ] = await slotStarts(provider);

    const { row, appointmentId } = await bookViaConfirmation(provider, start!, { email });

    expect(appointmentId).toBeNull();
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(0);
    expect(row).toMatchObject({
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
    expect(row.confirmedAt).not.toBeNull();
    expect(row.consentAcceptedAt).toBeInstanceOf(Date);
    expect(row.policyVersion).toBeTruthy();
    const audits = await prisma.auditLog.findMany({ where: { entityType: EntityType.BOOKING_REQUEST, entityId: row.id } });
    expect(audits.some((a) => a.source === ActionSource.PUBLIC_PORTAL && a.portalPatientId === null)).toBe(true);
    expect(JSON.stringify(audits)).not.toContain(email);
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

    const second = await bookViaConfirmation(provider, starts[3]!, { email });
    const first = await bookViaConfirmation(provider, starts[1]!, { email });
    await bookViaConfirmation(provider, starts[5]!, { email: unique('ajena@test.local') });
    await bookViaConfirmation(other, otherStart!, { email });

    const res = await getAppointments(session);
    expect(res.status).toBe(200);
    expect(res.body.data.consentRequired).toBe(true);
    expect(res.body.data.appointments).toEqual([]);
    expect(res.body.data.requests.map((r: { id: string }) => r.id)).toEqual([ first.requestId, second.requestId ]);
    const dto = res.body.data.requests[0];
    expect(Object.keys(dto).sort()).toEqual([ 'durationMinutes', 'endUtc', 'holdExpiresAt', 'id', 'location', 'startUtc', 'status', 'type' ]);
    expect(Object.keys(dto.type)).toEqual([ 'name' ]);
    expect(Object.keys(dto.location).sort()).toEqual([ 'address', 'isVirtual', 'name' ]);
  });

  it('hides expired, cancelled and other states', async () => {
    const provider = await approvalProvider();
    const session = sessionFor(provider.id, unique('estados@test.local'));
    const starts = await slotStarts(provider);
    const email = session.email;
    const a = await bookViaConfirmation(provider, starts[1]!, { email });
    const b = await bookViaConfirmation(provider, starts[2]!, { email });
    await prisma.bookingRequest.update({ where: { id: a.requestId }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    await prisma.bookingRequest.update({ where: { id: b.requestId }, data: { status: BookingRequestStatus.REJECTED } });

    expect((await getAppointments(session)).body.data.requests).toEqual([]);
  });
});

describe('self-serve requests ignore holds the patient has not confirmed', () => {
  it('neither lists nor cancels an unconfirmed hold, nor a PENDING row without confirmedAt', async () => {
    const provider = await approvalProvider();
    const session = sessionFor(provider.id, unique('sin-confirmar@test.local'));
    const [ first, second ] = await slotStarts(provider);
    const confirmed = await bookViaConfirmation(provider, first!, { email: session.email });
    const unconfirmed = await prisma.$transaction(async (tx) => {
      await withProviderLock(tx, provider.id);
      const { request } = await bookingRequestService.createUnconfirmedWithin(tx, provider.id, {
        email: session.email, name: 'Lucia', lastName: 'Rojas', typeId: provider.typeId, locationId: provider.locationId,
        startAt: new Date(second!), endAt: new Date(new Date(second!).getTime() + 3_600_000), patientTimezone: 'America/Bogota',
        policyVersion: 'v', consentAcceptedAt: new Date(), confirmTokenHash: 'c'.repeat(64), releaseTokenHash: 'r'.repeat(64),
      }, new Date());
      return request;
    });

    expect((await getAppointments(session)).body.data.requests.map((r: { id: string }) => r.id)).toEqual([ confirmed.requestId ]);
    expect((await cancelRequest(session, unconfirmed.id)).status).toBe(404);
    await prisma.bookingRequest.update({ where: { id: unconfirmed.id }, data: { status: BookingRequestStatus.PENDING } });
    expect((await getAppointments(session)).body.data.requests.map((r: { id: string }) => r.id)).toEqual([ confirmed.requestId ]);
    expect((await cancelRequest(session, unconfirmed.id)).status).toBe(404);
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: unconfirmed.id } })).status).toBe(BookingRequestStatus.PENDING);
  });
});

describe('POST /v1/portal/requests/:id/cancel', () => {
  it('cancels the patient\'s own request, releases the slot and audits', async () => {
    const provider = await approvalProvider();
    const session = sessionFor(provider.id, unique('cancela@test.local'));
    const [ start ] = await slotStarts(provider);
    const id = (await bookViaConfirmation(provider, start!, { email: session.email })).requestId;

    const res = await cancelRequest(session, id);
    expect(res.status).toBe(204);

    const stored = await prisma.bookingRequest.findUniqueOrThrow({ where: { id } });
    expect(stored.status).toBe(BookingRequestStatus.CANCELLED);
    expect(stored.resolvedAt).not.toBeNull();
    expect(await slotStarts(provider)).toContain(start);
    expect((await getAppointments(session)).body.data.requests).toEqual([]);

    const audits = await prisma.auditLog.findMany({ where: { entityType: EntityType.BOOKING_REQUEST, entityId: id } });
    expect(audits.map((a) => a.description)).toContain('Solicitud de reserva cancelada por el paciente desde el portal');
    expect((await bookViaConfirmation(provider, start!, { email: unique('otro@test.local') })).row.status).toBe(BookingRequestStatus.PENDING);
  });

  it('answers the same 404 for someone else\'s, another provider\'s, resolved, expired and unknown requests', async () => {
    const provider = await approvalProvider();
    const other = await approvalProvider();
    const owner = sessionFor(provider.id, unique('duena@test.local'));
    const starts = await slotStarts(provider);
    const mine = (await bookViaConfirmation(provider, starts[1]!, { email: owner.email })).requestId;
    const resolved = (await bookViaConfirmation(provider, starts[2]!, { email: owner.email })).requestId;
    const expired = (await bookViaConfirmation(provider, starts[3]!, { email: owner.email })).requestId;
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
    const id = (await bookViaConfirmation(provider, start!, { email: session.email })).requestId;

    expect((await cancelRequest(session, id, { csrf: null })).status).toBe(403);
    expect((await request(app).post(`/v1/portal/requests/${id}/cancel`).set('Origin', ALLOWED_ORIGIN).send()).status).toBe(401);
    expect((await prisma.bookingRequest.findUniqueOrThrow({ where: { id } })).status).toBe(BookingRequestStatus.PENDING);
  });

  it('still cancels while booking is paused', async () => {
    const provider = await approvalProvider();
    const session = sessionFor(provider.id, unique('pausa@test.local'));
    const [ start ] = await slotStarts(provider);
    const id = (await bookViaConfirmation(provider, start!, { email: session.email })).requestId;
    await prisma.user.update({ where: { id: provider.id }, data: { bookingEnabled: false } });

    expect((await cancelRequest(session, id)).status).toBe(204);
  });
});

describe('reschedule in approval mode', () => {
  it('is unavailable: the slots and move endpoints answer as an unknown provider', async () => {
    const provider = await createLiveProvider();
    const session = sessionFor(provider.id, unique('mueve@test.local'));
    const [ start, later ] = await slotStarts(provider);
    const appointmentId = (await bookViaConfirmation(provider, start!, { email: session.email })).appointmentId!;
    await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });

    const res = await portalPost(app, `/v1/portal/appointments/${appointmentId}/reschedule`, session, { startUtc: later, patientTimezone: 'America/Bogota' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Provider not found');
    expect((await portalPost(app, `/v1/portal/appointments/${appointmentId}/cancel`, session)).status).toBe(204);
  });
});
