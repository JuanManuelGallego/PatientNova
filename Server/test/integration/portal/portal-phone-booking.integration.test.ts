import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), send: vi.fn() }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: () => ({ send: mocks.send }) }));

import { authenticate, requireAdmin } from '../../../src/middlewares/authenticate.js';
import { requirePortalEnabled } from '../../../src/middlewares/require-portal-enabled.js';
import { bookingRequestRouter } from '../../../src/booking-requests/booking-request.routes.js';
import { auditLogRouter } from '../../../src/audit-log/audit-log.routes.js';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { phoneHash } from '../../../src/utils/encryption/blind-index.js';
import { resolvePortalPatient } from '../../../src/portal/patient-resolution.js';
import { deliverBookingRequestNotification } from '../../../src/booking-requests/booking-request-notifications.js';
import { PRIVACY_POLICY_VERSION } from '../../../src/portal/privacy-policy.js';
import {
  ActionSource,
  BookingApprovalMode,
  BookingRequestKind,
  BookingRequestStatus,
  Channel,
  ConsentKind,
  PatientStatus,
  RecordSource,
} from '../../../generated/prisma/enums.js';
import { createTestToken, invokeRoute, unique } from '../helpers.js';
import {
  bookViaConfirmation, buildPortalApp, createLiveProvider, phoneSessionFor, portalPost, slotStarts,
  type LiveProvider, type TestSession,
} from './portal-helpers.js';

const portal = config.portal as { patientEnabled: boolean; selfServe: boolean };
const scheduler = config.scheduler as { enabled: boolean };
const was = { portal: { ...portal }, scheduler: scheduler.enabled };
beforeAll(() => { portal.patientEnabled = true; portal.selfServe = true; });
afterAll(() => { Object.assign(portal, was.portal); scheduler.enabled = was.scheduler; });

let app: express.Express;
let seq = 0;
const newPhone = () => `+57301${String(1_000_000 + ++seq).padStart(7, '0')}`;
const TIMEZONE = 'America/Bogota';

beforeEach(() => {
  app = buildPortalApp();
  scheduler.enabled = false;
  mocks.dispatch.mockReset().mockResolvedValue({ success: true, messageSid: 'msg-1' });
  mocks.send.mockReset().mockResolvedValue('job-1');
});

interface PatientOpts {
  whatsappNumber?: string;
  smsNumber?: string;
  whatsappUnverified?: boolean;
  email?: string;
  status?: PatientStatus;
  portalAccessEnabled?: boolean;
  isDeleted?: boolean;
  reminderChannel?: Channel;
  consented?: boolean;
  name?: string;
}

async function patientWith(userId: string, opts: PatientOpts) {
  const { consented, isDeleted, name, ...data } = opts;
  const patient = await prisma.patient.create({
    data: {
      name: name ?? 'Lucia', lastName: 'Rojas', userId, status: PatientStatus.ACTIVE, reminderChannel: Channel.WHATSAPP,
      ...data,
      ...(isDeleted && { isDeleted: true, deletedAt: new Date() }),
    },
  });
  if (consented) {
    await prisma.patientConsent.create({
      data: { patientId: patient.id, userId, kind: ConsentKind.DATA_PROCESSING, policyVersion: PRIVACY_POLICY_VERSION, acceptedAt: new Date() },
    });
  }
  return patient;
}

const bookByPhone = (provider: LiveProvider, phone: string, start: string, channel: Channel = Channel.WHATSAPP) =>
  bookViaConfirmation(provider, start, { phone, channel, patient: { name: 'Lucia', lastName: 'Rojas' } });

const listAppointments = (s: TestSession) =>
  request(app).get('/v1/portal/appointments').set('Origin', 'http://localhost:3000').set('Cookie', s.cookie);

const patientsOf = (userId: string) => prisma.patient.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });

describe('resolvePortalPatient with a phone', () => {
  const resolve = (userId: string, value: string, channel: Channel = Channel.WHATSAPP) =>
    resolvePortalPatient({ userId, contact: { channel, value } });

  it('no record: none, the same as an unknown email', async () => {
    const provider = await createLiveProvider();
    expect(await resolve(provider.id, newPhone())).toEqual({ kind: 'none' });
  });

  it('one active trusted record: that patient, on either channel', async () => {
    const provider = await createLiveProvider();
    const [ whatsapp, sms ] = [ newPhone(), newPhone() ];
    const a = await patientWith(provider.id, { whatsappNumber: whatsapp });
    const b = await patientWith(provider.id, { smsNumber: sms });
    expect(await resolve(provider.id, whatsapp, Channel.SMS)).toEqual({ kind: 'patient', patientId: a.id });
    expect(await resolve(provider.id, sms, Channel.WHATSAPP)).toEqual({ kind: 'patient', patientId: b.id });
  });

  it('one active trusted record that is inactive: reviewable, the same as an email', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    await patientWith(provider.id, { whatsappNumber: phone, status: PatientStatus.INACTIVE });
    expect(await resolve(provider.id, phone)).toEqual({ kind: 'unavailable', review: true });
  });

  it('several active records: never auto-picks', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    await patientWith(provider.id, { whatsappNumber: phone });
    await patientWith(provider.id, { smsNumber: phone });
    expect(await resolve(provider.id, phone)).toEqual({ kind: 'unavailable', review: true });
  });

  it('only unverified matches: reviewable, never an identity', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    await patientWith(provider.id, { whatsappNumber: phone, whatsappUnverified: true });
    expect(await resolve(provider.id, phone)).toEqual({ kind: 'unavailable', review: true });
  });

  it('a typed number does not block the record that really holds it', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    const holder = await patientWith(provider.id, { whatsappNumber: phone });
    await patientWith(provider.id, { whatsappNumber: phone, whatsappUnverified: true });
    expect(await resolve(provider.id, phone)).toEqual({ kind: 'patient', patientId: holder.id });
  });

  it('a record with the number as SMS stays trusted even when another WhatsApp number is unverified', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    const patient = await patientWith(provider.id, { smsNumber: phone, whatsappNumber: newPhone(), whatsappUnverified: true });
    expect(await resolve(provider.id, phone)).toEqual({ kind: 'patient', patientId: patient.id });
  });

  it('any active match with portal access revoked fails closed for the whole number', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    await patientWith(provider.id, { whatsappNumber: phone });
    await patientWith(provider.id, { smsNumber: phone, portalAccessEnabled: false });
    expect(await resolve(provider.id, phone)).toEqual({ kind: 'unavailable', review: false });
  });

  it('deleted only: reviewable, or not when its access was revoked, the same as an email', async () => {
    const provider = await createLiveProvider();
    const [ deleted, revoked ] = [ newPhone(), newPhone() ];
    await patientWith(provider.id, { whatsappNumber: deleted, isDeleted: true });
    await patientWith(provider.id, { whatsappNumber: revoked, isDeleted: true, portalAccessEnabled: false });
    expect(await resolve(provider.id, deleted)).toEqual({ kind: 'unavailable', review: true });
    expect(await resolve(provider.id, revoked)).toEqual({ kind: 'unavailable', review: false });
  });

  it('is scoped to the provider', async () => {
    const [ provider, other ] = [ await createLiveProvider(), await createLiveProvider() ];
    const phone = newPhone();
    await patientWith(other.id, { whatsappNumber: phone });
    expect(await resolve(provider.id, phone)).toEqual({ kind: 'none' });
  });
});

describe('booking from a phone session', () => {
  it.each([
    [ Channel.WHATSAPP, 'whatsappNumber' ],
    [ Channel.SMS, 'smsNumber' ],
  ] as const)('a new patient on %s gets the number on that channel, no email, and is not flagged', async (channel, field) => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    const [ start ] = await slotStarts(provider);

    const { appointmentId } = await bookByPhone(provider, phone, start!, channel);

    const [ patient ] = await patientsOf(provider.id);
    expect(patient).toMatchObject({
      [ field ]: phone, email: null, reminderChannel: channel, whatsappUnverified: false, source: RecordSource.PORTAL,
    });
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId! }, include: { reminder: true } });
    expect(appt.reminder).toMatchObject({ channel, to: phone });
    const patientMessages = mocks.dispatch.mock.calls.filter(([ , opts ]) => opts.to === phone);
    expect(patientMessages).toHaveLength(1);
    expect(patientMessages[ 0 ]![0]).toBe(channel);
  });

  it('books for the one trusted record without changing it', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    const patient = await patientWith(provider.id, { whatsappNumber: phone, consented: true, email: unique('a@test.local') });
    const [ start ] = await slotStarts(provider);

    const { appointmentId } = await bookByPhone(provider, phone, start!);

    expect(await patientsOf(provider.id)).toHaveLength(1);
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId! } });
    expect(appt.patientId).toBe(patient.id);
    expect((await listAppointments(phoneSessionFor(provider.id, phone))).body.data.appointments).toHaveLength(1);
  });

  it('two concurrent bookings by a new number create one patient', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    const [ first, second ] = await slotStarts(provider);

    const results = await Promise.all([
      bookByPhone(provider, phone, first!),
      bookByPhone(provider, phone, second!),
    ]);

    expect(results.every((r) => r.appointmentId !== null)).toBe(true);
    const patients = await patientsOf(provider.id);
    expect(patients).toHaveLength(1);
    expect(await prisma.appointment.count({ where: { patientId: patients[ 0 ]!.id } })).toBe(2);
  });

  it.each([
    [ 'several active records', async (userId: string, phone: string) => {
      await patientWith(userId, { whatsappNumber: phone, consented: true });
      await patientWith(userId, { smsNumber: phone, consented: true });
    } ],
    [ 'only an unverified record', async (userId: string, phone: string) => {
      await patientWith(userId, { whatsappNumber: phone, whatsappUnverified: true, consented: true });
    } ],
    [ 'a deleted record', async (userId: string, phone: string) => {
      await patientWith(userId, { whatsappNumber: phone, isDeleted: true });
    } ],
  ])('%s goes to review, with no patient touched and nothing listed', async (_name, seed) => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    await seed(provider.id, phone);
    const before = await patientsOf(provider.id);
    const session = phoneSessionFor(provider.id, phone);
    const [ start ] = await slotStarts(provider);

    const { row, appointmentId } = await bookByPhone(provider, phone, start!);

    expect(appointmentId).toBeNull();
    expect(row.status).toBe('PENDING');
    expect(await patientsOf(provider.id)).toHaveLength(before.length);
    const stored = await prisma.bookingRequest.findFirstOrThrow({ where: { userId: provider.id } });
    expect(stored).toMatchObject({ kind: BookingRequestKind.REVIEW, email: null, verifiedPhone: phone, contactChannel: Channel.WHATSAPP });
    const list = await listAppointments(session);
    expect(list.body.data).toMatchObject({ appointments: [], consentRequired: true });
    expect(list.body.data.requests).toHaveLength(1);
  });

  it('a revoked number stays blocked and is never reviewable', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    await patientWith(provider.id, { whatsappNumber: phone, portalAccessEnabled: false });
    const [ start ] = await slotStarts(provider);

    await expect(bookByPhone(provider, phone, start!)).rejects.toMatchObject({ errorCode: 409 });

    expect(await prisma.bookingRequest.count({ where: { userId: provider.id, status: { not: 'CANCELLED' } } })).toBe(0);
  });

  it('list and consent answers do not reveal whether a number belongs to a patient', async () => {
    const provider = await createLiveProvider();
    const [ fresh, shared, flagged, revoked ] = [ newPhone(), newPhone(), newPhone(), newPhone() ];
    await patientWith(provider.id, { whatsappNumber: shared });
    await patientWith(provider.id, { smsNumber: shared });
    await patientWith(provider.id, { whatsappNumber: flagged, whatsappUnverified: true });
    await patientWith(provider.id, { whatsappNumber: revoked, portalAccessEnabled: false });

    const answers = [];
    for (const phone of [ fresh, shared, flagged, revoked ]) {
      const session = phoneSessionFor(provider.id, phone);
      const list = await listAppointments(session);
      const consent = await portalPost(app, '/v1/portal/consent', session, { accepted: true });
      answers.push({ list: list.status, data: list.body.data, consent: consent.status });
    }

    expect(answers).toEqual(Array(4).fill({ list: 200, data: { appointments: [], requests: [], consentRequired: true }, consent: 204 }));
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
  });
});

describe('a number typed by an email session', () => {
  it('never matches a phone session, as a patient or as a request', async () => {
    const provider = await createLiveProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });
    const typed = newPhone();
    const [ start ] = await slotStarts(provider);
    const email = unique('correo@test.local');

    const { requestId, row } = await bookViaConfirmation(provider, start!, { email, patient: { name: 'Ana', lastName: 'Ruiz', phone: typed } });
    expect(row.status).toBe('PENDING');

    const holder = phoneSessionFor(provider.id, typed);
    const list = await listAppointments(holder);
    expect(list.body.data.requests).toEqual([]);
    const cancel = await portalPost(app, `/v1/portal/requests/${requestId}/cancel`, holder, {});
    expect(cancel.status).toBe(404);
  });

  it('flags the new patient, so the holder of the number cannot reach the record', async () => {
    const provider = await createLiveProvider();
    const typed = newPhone();
    const [ first, second ] = await slotStarts(provider);
    const email = unique('correo@test.local');

    const res = await bookViaConfirmation(provider, first!, { email, patient: { name: 'Ana', lastName: 'Ruiz', phone: typed } });
    expect(res.appointmentId).not.toBeNull();
    const [ patient ] = await patientsOf(provider.id);
    expect(patient).toMatchObject({ whatsappNumber: typed, whatsappUnverified: true });

    const holder = phoneSessionFor(provider.id, typed);
    expect((await listAppointments(holder)).body.data).toMatchObject({ appointments: [], consentRequired: true });
    const booked = await bookByPhone(provider, typed, second!);
    expect(booked.appointmentId).toBeNull();
    expect(booked.row).toMatchObject({ kind: BookingRequestKind.REVIEW });
    expect(await patientsOf(provider.id)).toHaveLength(1);
    expect(await prisma.appointment.count({ where: { patientId: patient!.id } })).toBe(1);
  });
});

describe('requests from a phone session', () => {
  async function approvalProvider() {
    const provider = await createLiveProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });
    return provider;
  }

  it('stores the proven number encrypted, with its blind index, and no email', async () => {
    const provider = await approvalProvider();
    const phone = newPhone();
    const [ start ] = await slotStarts(provider);

    const { requestId } = await bookByPhone(provider, phone, start!, Channel.SMS);

    const [ raw ] = await prisma.$queryRaw<{ verifiedPhone: string; verifiedPhoneHash: string; email: string | null; contactChannel: Channel }[]>`
      SELECT "verifiedPhone", "verifiedPhoneHash", "email", "contactChannel" FROM booking_requests WHERE id = ${requestId}::uuid`;
    expect(raw!.verifiedPhone).not.toContain(phone);
    expect(raw!.verifiedPhoneHash).toBe(phoneHash(phone));
    expect(raw!.email).toBeNull();
    expect(raw!.contactChannel).toBe(Channel.SMS);
  });

  it('lists and cancels only the session\'s own requests', async () => {
    const provider = await approvalProvider();
    const phone = newPhone();
    const [ start ] = await slotStarts(provider);
    const session = phoneSessionFor(provider.id, phone);
    const id = (await bookByPhone(provider, phone, start!)).requestId;

    expect((await listAppointments(session)).body.data.requests.map((r: { id: string }) => r.id)).toEqual([ id ]);
    expect((await portalPost(app, `/v1/portal/requests/${id}/cancel`, phoneSessionFor(provider.id, newPhone()), {})).status).toBe(404);
    expect((await portalPost(app, `/v1/portal/requests/${id}/cancel`, phoneSessionFor(provider.id, phone, Channel.SMS), {})).status).toBe(204);
  });

  it.each([
    [ 'REJECTED', 'rejected', config.twilio.patientPortal.requestRejectedSid ],
    [ 'EXPIRED', 'expired', config.twilio.patientPortal.requestExpiredSid ],
  ] as const)('a %s request goes to the proven number on its channel', async (status, event, contentSid) => {
    const provider = await approvalProvider();
    const phone = newPhone();
    const [ start ] = await slotStarts(provider);
    const { requestId } = await bookByPhone(provider, phone, start!);
    await prisma.bookingRequest.update({ where: { id: requestId }, data: { status } });
    mocks.dispatch.mockClear();

    await deliverBookingRequestNotification({ requestId, event });

    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch.mock.calls[ 0 ]![0]).toBe(Channel.WHATSAPP);
    expect(mocks.dispatch.mock.calls[ 0 ]![1]).toMatchObject({ to: phone, contentSid });
  });
});

describe('provider inbox with a phone request', () => {
  const inbox = express();
  inbox.use(express.json());
  inbox.use(cookieParser());
  inbox.use('/v1/booking-requests', authenticate, requirePortalEnabled, requireAdmin, bookingRequestRouter);

  async function setup() {
    const provider = await createLiveProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: provider.id } });
    const headers = { Authorization: `Bearer ${createTestToken({ id: user.id, email: user.email, role: user.role })}` };
    return { provider, headers };
  }

  async function phoneRequest(provider: LiveProvider, phone: string) {
    const [ start ] = await slotStarts(provider);
    const { row } = await bookByPhone(provider, phone, start!);
    expect(row.status).toBe('PENDING');
    return row.id;
  }

  type Headers = Record<string, string>;
  const detail = (id: string, headers: Headers) => request(inbox).get(`/v1/booking-requests/${id}`).set(headers);
  const approve = (id: string, headers: Headers, body: object = {}) =>
    request(inbox).post(`/v1/booking-requests/${id}/approve`).set(headers).send(body);

  const appointmentOf = async (requestId: string) => {
    const req = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: requestId } });
    return prisma.appointment.findUniqueOrThrow({ where: { id: req.appointmentId! }, include: { reminder: true } });
  };

  it('shows the proven number and finds candidates by it, flagging typed matches', async () => {
    const { provider, headers } = await setup();
    const phone = newPhone();
    const trusted = await patientWith(provider.id, { smsNumber: phone });
    const flagged = await patientWith(provider.id, { whatsappNumber: phone, whatsappUnverified: true });
    await patientWith(provider.id, { whatsappNumber: newPhone() });
    const id = await phoneRequest(provider, phone);

    const { body } = await detail(id, headers);

    expect(body.data).toMatchObject({ email: null, verifiedPhone: phone, contactChannel: Channel.WHATSAPP, phone: null });
    const candidates = body.data.candidates as { id: string; unverifiedMatch: boolean; whatsappHash?: string }[];
    expect(candidates.map((c) => c.id).sort()).toEqual([ trusted.id, flagged.id ].sort());
    expect(candidates.find((c) => c.id === flagged.id)!.unverifiedMatch).toBe(true);
    expect(candidates.find((c) => c.id === trusted.id)!.unverifiedMatch).toBe(false);
    expect(candidates[ 0 ]).not.toHaveProperty('whatsappHash');
    expect(candidates[ 0 ]).not.toHaveProperty('smsHash');
  });

  it('approval with no candidates creates a patient from the proven number', async () => {
    const { provider, headers } = await setup();
    const phone = newPhone();
    const id = await phoneRequest(provider, phone);

    expect((await approve(id, headers)).status).toBe(200);

    const [ patient ] = await patientsOf(provider.id);
    expect(patient).toMatchObject({ whatsappNumber: phone, email: null, reminderChannel: Channel.WHATSAPP, whatsappUnverified: false });
    expect((await appointmentOf(id)).reminder).toMatchObject({ channel: Channel.WHATSAPP, to: phone });
    expect(await prisma.patientConsent.count({ where: { patientId: patient!.id } })).toBe(1);
  });

  it('approval with no choice reuses the single trusted record', async () => {
    const { provider, headers } = await setup();
    const phone = newPhone();
    const patient = await patientWith(provider.id, { whatsappNumber: phone });
    const id = await phoneRequest(provider, phone);

    await approve(id, headers);

    expect((await appointmentOf(id)).patientId).toBe(patient.id);
    expect(await patientsOf(provider.id)).toHaveLength(1);
  });

  it('a shared number never picks a record on its own: with no choice a new patient is created', async () => {
    const { provider, headers } = await setup();
    const phone = newPhone();
    await patientWith(provider.id, { whatsappNumber: phone });
    await patientWith(provider.id, { smsNumber: phone });
    const id = await phoneRequest(provider, phone);

    await approve(id, headers);

    expect(await patientsOf(provider.id)).toHaveLength(3);
  });

  it('the provider picks among active candidates', async () => {
    const { provider, headers } = await setup();
    const phone = newPhone();
    await patientWith(provider.id, { whatsappNumber: phone });
    const chosen = await patientWith(provider.id, { smsNumber: phone, status: PatientStatus.INACTIVE });
    const id = await phoneRequest(provider, phone);

    expect((await approve(id, headers, { existingPatientId: chosen.id })).status).toBe(200);

    expect((await appointmentOf(id)).patientId).toBe(chosen.id);
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: chosen.id } })).status).toBe(PatientStatus.ACTIVE);
  });

  it('picking a flagged record clears its flag and audits it', async () => {
    const { provider, headers } = await setup();
    const phone = newPhone();
    const flagged = await patientWith(provider.id, { whatsappNumber: phone, whatsappUnverified: true });
    const id = await phoneRequest(provider, phone);

    await approve(id, headers, { existingPatientId: flagged.id });

    expect((await prisma.patient.findUniqueOrThrow({ where: { id: flagged.id } })).whatsappUnverified).toBe(false);
    const audit = await prisma.auditLog.findMany({ where: { entityId: flagged.id } });
    expect(audit.some((a) => a.affectedFields.includes('whatsappUnverified'))).toBe(true);
    expect((await resolvePortalPatient({ userId: provider.id, contact: { channel: Channel.WHATSAPP, value: phone } })).kind).toBe('patient');
  });

  it('picking a record matched by another number leaves its unverified WhatsApp number flagged', async () => {
    const { provider, headers } = await setup();
    const phone = newPhone();
    const record = await patientWith(provider.id, { smsNumber: phone, whatsappNumber: newPhone(), whatsappUnverified: true });
    const id = await phoneRequest(provider, phone);

    await approve(id, headers, { existingPatientId: record.id });

    expect((await prisma.patient.findUniqueOrThrow({ where: { id: record.id } })).whatsappUnverified).toBe(true);
  });

  it('restoring a deleted record is allowed while another shares the number, and clears a flag on the proven number', async () => {
    const { provider, headers } = await setup();
    const phone = newPhone();
    await patientWith(provider.id, { whatsappNumber: phone });
    const deleted = await patientWith(provider.id, { whatsappNumber: phone, whatsappUnverified: true, isDeleted: true });
    const id = await phoneRequest(provider, phone);

    expect((await approve(id, headers, { restorePatientId: deleted.id })).status).toBe(200);

    expect(await prisma.patient.findUniqueOrThrow({ where: { id: deleted.id } })).toMatchObject({ isDeleted: false, whatsappUnverified: false });
    expect((await appointmentOf(id)).patientId).toBe(deleted.id);
  });

  it('an email request restoring a flagged record leaves the typed number flagged', async () => {
    const { provider, headers } = await setup();
    const email = unique('correo@test.local').toLowerCase();
    const deleted = await patientWith(provider.id, { email, whatsappNumber: newPhone(), whatsappUnverified: true, isDeleted: true, reminderChannel: Channel.EMAIL });
    const [ start ] = await slotStarts(provider);
    const { requestId } = await bookViaConfirmation(provider, start!, { email });

    expect((await approve(requestId, headers, { restorePatientId: deleted.id })).status).toBe(200);

    expect(await prisma.patient.findUniqueOrThrow({ where: { id: deleted.id } })).toMatchObject({ isDeleted: false, whatsappUnverified: true });
  });

  it('rejects a chosen id outside the candidates, and both ids together', async () => {
    const { provider, headers } = await setup();
    const phone = newPhone();
    const stranger = await patientWith(provider.id, { whatsappNumber: newPhone() });
    const id = await phoneRequest(provider, phone);

    const outside = await approve(id, headers, { existingPatientId: stranger.id });
    expect(outside.status).toBe(404);
    expect(outside.body.error).toBe('Patient not found for this request');
    expect((await approve(id, headers, { existingPatientId: stranger.id, restorePatientId: stranger.id })).status).toBe(400);
    expect(await prisma.bookingRequest.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: BookingRequestStatus.PENDING });
  });
});

describe('audit of a phone session', () => {
  const list = async (userId: string, query: Record<string, unknown>) => {
    const res = await invokeRoute(auditLogRouter, 'get', '/', { user: { id: userId, timezone: TIMEZONE }, ip: '127.0.0.1', query });
    return res.body as { data: { data: { source: string; portalPatientId: string | null; actorId: string }[] } };
  };

  it('links the rows to the patient, and ?portalPatientId= finds a patient with no email', async () => {
    const provider = await createLiveProvider();
    const phone = newPhone();
    const [ start ] = await slotStarts(provider);

    await bookByPhone(provider, phone, start!);

    const [ patient ] = await patientsOf(provider.id);
    expect(patient!.email).toBeNull();
    const rows = (await list(provider.id, { portalPatientId: patient!.id })).data.data;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.source === ActionSource.PUBLIC_PORTAL)).toBe(true);
    expect(rows.some((r) => r.portalPatientId === patient!.id)).toBe(true);
  });

  it('finds the unlinked rows of a number, but not those of a number only typed in the form', async () => {
    const provider = await createLiveProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });
    const [ verified, typed ] = [ newPhone(), newPhone() ];
    const [ first, second ] = await slotStarts(provider);
    await bookByPhone(provider, verified, first!);
    await bookByPhone(provider, typed, second!);
    const holder = await patientWith(provider.id, { whatsappNumber: verified });
    const stranger = await patientWith(provider.id, { whatsappNumber: typed, whatsappUnverified: true });

    expect((await list(provider.id, { portalPatientId: holder.id })).data.data).not.toHaveLength(0);
    expect((await list(provider.id, { portalPatientId: stranger.id })).data.data).toHaveLength(0);
  });
});
