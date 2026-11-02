import type express from 'express';
import request from 'supertest';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const failConsent = vi.hoisted(() => ({ on: false }));
vi.mock('../../../src/patient-consents/patient-consent.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/patient-consents/patient-consent.service.js')>();
  return {
    ...actual,
    ensureCurrentConsent: (...args: Parameters<typeof actual.ensureCurrentConsent>) =>
      failConsent.on ? Promise.reject(new Error('consent write failed')) : actual.ensureCurrentConsent(...args),
  };
});

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { emailHash } from '../../../src/utils/encryption/blind-index.js';
import { publicBookingService } from '../../../src/public-booking/public-booking.service.js';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import {
  ActionSource,
  AppointmentStatus,
  BookingApprovalMode,
  Channel,
  EntityType,
  PatientStatus,
  RecordSource,
} from '../../../generated/prisma/enums.js';
import { createTestAppointmentType, createTestLocation, createTestPatient, unique } from '../helpers.js';
import { ALLOWED_ORIGIN, buildPortalApp, createLiveProvider, sessionFor, type LiveProvider, type TestSession } from './portal-helpers.js';

const ZONE = 'America/Bogota';

let app: express.Express;
const portal = config.portal as { patientEnabled: boolean };
const portalWas = portal.patientEnabled;
beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = portalWas; });
beforeEach(() => {
  app = buildPortalApp();
  failConsent.on = false;
});

/** Grid starts (ISO, UTC) on the provider-local day `daysAhead` from today, from the real slot engine. */
async function slotsOn(provider: LiveProvider, daysAhead = 3): Promise<string[]> {
  const date = DateTime.now().setZone(ZONE).plus({ days: daysAhead }).toISODate()!;
  const { slots } = await publicBookingService.getSlots(provider.slug, { typeId: provider.typeId, from: date, to: date });
  return slots.map((s) => s.startUtc);
}

/** A provider-local wall time `daysAhead` from today, as an ISO UTC instant. */
function localAt(daysAhead: number, hour: number, minute = 0): string {
  return DateTime.now().setZone(ZONE).plus({ days: daysAhead }).set({ hour, minute, second: 0, millisecond: 0 }).toUTC().toISO()!;
}

function bookingBody(provider: LiveProvider, startUtc: string, overrides: Record<string, unknown> = {}) {
  return {
    typeId: provider.typeId,
    locationId: provider.locationId,
    startUtc,
    patientTimezone: 'America/New_York',
    consentAccepted: true,
    patient: { name: 'Lucia', lastName: 'Rojas', phone: '+573001112233' },
    ...overrides,
  };
}

const postBooking = (s: TestSession, body: unknown, csrf: string | null = s.csrf) => {
  const req = request(app).post('/v1/portal/bookings').set('Origin', ALLOWED_ORIGIN).set('Cookie', s.cookie);
  if (csrf !== null) req.set('X-CSRF-Token', csrf);
  return req.send(body as object);
};

const getAppointments = (s: TestSession) =>
  request(app).get('/v1/portal/appointments').set('Cookie', s.cookie);

const patientByEmail = (userId: string, email: string) =>
  prisma.patient.findMany({ where: { userId, emailHash: emailHash(email)! } });

const appointmentsOf = (userId: string) =>
  prisma.appointment.findMany({ where: { userId }, orderBy: { startAt: 'asc' } });

describe('POST /v1/portal/bookings', () => {
  it('books for a new patient: creates the patient, consent and a CONFIRMED portal appointment in one go', async () => {
    const provider = await createLiveProvider({ price: 150000 });
    const email = unique('nueva@test.local');
    const [ start ] = await slotsOn(provider);

    const res = await postBooking(sessionFor(provider.id, email), bookingBody(provider, start!));

    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    const dto = res.body.data.appointment;
    expect(Object.keys(dto).sort()).toEqual([ 'durationMinutes', 'endUtc', 'id', 'location', 'price', 'startUtc', 'status', 'type' ]);
    expect(dto).toMatchObject({ startUtc: start, durationMinutes: 60, status: 'CONFIRMED', price: 150000 });
    expect(Object.keys(dto.location).sort()).toEqual([ 'address', 'instructions', 'name' ]);

    const [ patient, ...others ] = await patientByEmail(provider.id, email);
    expect(others).toHaveLength(0);
    expect(patient).toMatchObject({
      name: 'Lucia',
      lastName: 'Rojas',
      email,
      whatsappNumber: '+573001112233',
      reminderChannel: Channel.EMAIL,
      source: RecordSource.PORTAL,
      portalAccessEnabled: true,
      status: PatientStatus.ACTIVE,
    });

    const [ appt ] = await appointmentsOf(provider.id);
    expect(appt).toMatchObject({
      id: dto.id,
      patientId: patient!.id,
      status: AppointmentStatus.CONFIRMED,
      source: RecordSource.PORTAL,
      price: 150000,
      paid: false,
      patientTimezone: 'America/New_York',
      typeId: provider.typeId,
      locationId: provider.locationId,
    });
    expect(appt!.confirmedAt).toBeInstanceOf(Date);
    expect(appt!.endAt.getTime() - appt!.startAt.getTime()).toBe(60 * 60_000);

    expect(await prisma.patientConsent.count({ where: { patientId: patient!.id } })).toBe(1);
    const audits = await prisma.auditLog.findMany({ where: { userId: provider.id, source: ActionSource.PUBLIC_PORTAL } });
    expect(audits.map((a) => a.entityType).sort()).toEqual(
      [ EntityType.APPOINTMENT, EntityType.PATIENT, EntityType.PATIENT_CONSENT ].sort(),
    );
  });

  it('never modifies an existing patient and reuses their consent', async () => {
    const provider = await createLiveProvider();
    const existing = await createTestPatient(provider.id, { name: 'Ana', lastName: 'Perez' });
    const session = sessionFor(provider.id, existing.email!);
    const consent = await request(app).post('/v1/portal/consent')
      .set('Origin', ALLOWED_ORIGIN).set('Cookie', session.cookie).set('X-CSRF-Token', session.csrf).send({ accepted: true });
    expect(consent.status).toBe(204);
    const [ start ] = await slotsOn(provider);

    const res = await postBooking(session, bookingBody(provider, start!, { patient: { name: 'Otro', lastName: 'Nombre', phone: '+15551234567' } }));

    expect(res.status).toBe(201);
    const after = await prisma.patient.findUniqueOrThrow({ where: { id: existing.id } });
    expect(after).toMatchObject({ name: 'Ana', lastName: 'Perez', whatsappNumber: null, source: RecordSource.PROVIDER });
    expect(after.updatedAt).toEqual(existing.updatedAt);
    expect(await patientByEmail(provider.id, existing.email!)).toHaveLength(1);
    expect(await prisma.patientConsent.count({ where: { patientId: existing.id } })).toBe(1);
    const [ appt ] = await appointmentsOf(provider.id);
    expect(appt!.patientId).toBe(existing.id);
  });

  it('answers one neutral 409 for revoked, inactive and deleted-only patients and writes nothing', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotsOn(provider);
    const revoked = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: revoked.id }, data: { portalAccessEnabled: false } });
    const inactive = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: inactive.id }, data: { status: PatientStatus.INACTIVE } });
    const deleted = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: deleted.id }, data: { isDeleted: true, deletedAt: new Date() } });

    const errors = [];
    for (const p of [ revoked, inactive, deleted ]) {
      const res = await postBooking(sessionFor(provider.id, p.email!), bookingBody(provider, start!));
      expect(res.status).toBe(409);
      errors.push(res.body.error);
    }
    expect(new Set(errors)).toEqual(new Set([ 'Online booking unavailable' ]));
    expect(await appointmentsOf(provider.id)).toHaveLength(0);
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(3);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
  });

  it('lets exactly one of two concurrent bookings of the same slot win', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotsOn(provider);
    const results = await Promise.all([
      postBooking(sessionFor(provider.id, unique('a@test.local')), bookingBody(provider, start!)),
      postBooking(sessionFor(provider.id, unique('b@test.local')), bookingBody(provider, start!)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([ 201, 409 ]);
    expect(results.find((r) => r.status === 409)!.body.error).toBe('Slot no longer available');
    expect(await appointmentsOf(provider.id)).toHaveLength(1);
    // The loser's patient and consent rolled back with its transaction.
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(1);
  });

  it('creates one patient when the same new email books two slots at once', async () => {
    const provider = await createLiveProvider();
    const email = unique('doble@test.local');
    const [ first, second ] = await slotsOn(provider);
    const results = await Promise.all([
      postBooking(sessionFor(provider.id, email), bookingBody(provider, first!)),
      postBooking(sessionFor(provider.id, email), bookingBody(provider, second!)),
    ]);
    expect(results.map((r) => r.status)).toEqual([ 201, 201 ]);
    expect(await patientByEmail(provider.id, email)).toHaveLength(1);
    expect(await appointmentsOf(provider.id)).toHaveLength(2);
  });

  it('races an admin create of the same slot with exactly one winner', async () => {
    const provider = await createLiveProvider();
    const adminPatient = await createTestPatient(provider.id);
    const [ start ] = await slotsOn(provider);
    const end = new Date(new Date(start!).getTime() + 60 * 60_000).toISOString();

    const [ portalRes, adminRes ] = await Promise.allSettled([
      postBooking(sessionFor(provider.id, unique('race@test.local')), bookingBody(provider, start!)),
      appointmentService.create({
        startAt: start!, endAt: end, price: 0, paid: false, status: AppointmentStatus.SCHEDULED,
        patientId: adminPatient.id, locationId: provider.locationId, typeId: provider.typeId,
      }, provider.id),
    ]);

    const portalWon = portalRes.status === 'fulfilled' && portalRes.value.status === 201;
    const adminWon = adminRes.status === 'fulfilled';
    expect(portalWon !== adminWon).toBe(true);
    if (!portalWon) expect(portalRes.status === 'fulfilled' && portalRes.value.status).toBe(409);
    expect(await appointmentsOf(provider.id)).toHaveLength(1);
  });

  it('rejects starts the slot engine would not offer with the same 409', async () => {
    const provider = await createLiveProvider({ bufferMinutes: 30 });
    const slots = await slotsOn(provider);
    const busyPatient = await createTestPatient(provider.id);
    // An appointment at the third slot: the buffer makes the second slot (back-to-back) unavailable.
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

    const rejected = [
      slots[1]!, // buffer before the existing appointment
      slots[2]!, // the existing appointment itself
      slots[6]!, // blocked time
      offGrid, // between grid starts
      localAt(3, 20), // outside the 08:00-18:00 window
      localAt(3, 17, 30), // would end after the window
      localAt(-1, 9), // in the past (lead time)
      localAt(40, 9), // past the 30-day horizon
    ];
    for (const start of rejected) {
      const res = await postBooking(sessionFor(provider.id, unique('slot@test.local')), bookingBody(provider, start));
      expect({ start, status: res.status, error: res.body.error }).toEqual({ start, status: 409, error: 'Slot no longer available' });
    }
    expect(await appointmentsOf(provider.id)).toHaveLength(1);
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(1);
  });

  it('allows back-to-back bookings when the buffer is 0', async () => {
    const provider = await createLiveProvider();
    const [ first, second ] = await slotsOn(provider);
    expect((await postBooking(sessionFor(provider.id, unique('b2b@test.local')), bookingBody(provider, first!))).status).toBe(201);
    expect((await postBooking(sessionFor(provider.id, unique('b2b@test.local')), bookingBody(provider, second!))).status).toBe(201);
  });

  it('answers 404 for a type or location that is not bookable online', async () => {
    const provider = await createLiveProvider();
    const other = await createLiveProvider();
    const [ start ] = await slotsOn(provider);
    const session = sessionFor(provider.id, unique('tipo@test.local'));
    const hiddenType = await createTestAppointmentType(provider.id);
    const virtual = await createTestLocation(provider.id, { isVirtual: true });
    await prisma.appointmentLocation.update({ where: { id: virtual.id }, data: { bookableOnline: true } });
    const inactiveType = await createTestAppointmentType(provider.id);
    await prisma.appointmentType.update({ where: { id: inactiveType.id }, data: { bookableOnline: true, isActive: false } });

    const cases: [ Record<string, unknown>, string ][] = [
      [ { typeId: hiddenType.id }, 'Appointment type not found' ],
      [ { typeId: inactiveType.id }, 'Appointment type not found' ],
      [ { typeId: other.typeId }, 'Appointment type not found' ],
      [ { locationId: virtual.id }, 'Location not found' ],
      [ { locationId: other.locationId }, 'Location not found' ],
    ];
    for (const [ override, error ] of cases) {
      const res = await postBooking(session, bookingBody(provider, start!, override));
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 404, error });
    }
    expect(await appointmentsOf(provider.id)).toHaveLength(0);
  });

  it('validates the body strictly (400) before touching the database', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotsOn(provider);
    const session = sessionFor(provider.id, unique('body@test.local'));
    const base = bookingBody(provider, start!);
    const { consentAccepted: _omit, ...withoutConsent } = base;

    const bodies = [
      withoutConsent,
      { ...base, consentAccepted: false },
      { ...base, patient: { name: 'Lucia' } },
      { ...base, patient: { name: '  ', lastName: 'Rojas' } },
      { ...base, price: 0 },
      { ...base, endUtc: start },
      { ...base, status: 'SCHEDULED' },
      { ...base, patientTimezone: 'Mars/Olympus_Mons' },
      { ...base, startUtc: 'mañana' },
    ];
    for (const body of bodies) {
      expect((await postBooking(session, body)).status).toBe(400);
    }
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(0);
  });

  it('caps a patient at 3 upcoming portal bookings; provider-created, cancelled and past ones do not count', async () => {
    const provider = await createLiveProvider();
    const email = unique('tope@test.local');
    const session = sessionFor(provider.id, email);
    const slots = await slotsOn(provider);

    for (const start of slots.slice(0, 3)) {
      expect((await postBooking(session, bookingBody(provider, start))).status).toBe(201);
    }
    const fourth = await postBooking(session, bookingBody(provider, slots[3]!));
    expect({ status: fourth.status, error: fourth.body.error }).toEqual({ status: 409, error: 'Booking limit reached' });

    const [ patient ] = await patientByEmail(provider.id, email);
    await prisma.appointment.createMany({
      data: [
        { userId: provider.id, patientId: patient!.id, startAt: new Date(slots[8]!), endAt: new Date(slots[9]!), price: 0 },
        {
          userId: provider.id, patientId: patient!.id, source: RecordSource.PORTAL, price: 0,
          startAt: new Date(Date.now() - 2 * 3600_000), endAt: new Date(Date.now() - 3600_000),
        },
      ],
    });
    await prisma.appointment.updateMany({
      where: { userId: provider.id, startAt: new Date(slots[0]!) },
      data: { status: AppointmentStatus.CANCELLED },
    });

    expect((await postBooking(session, bookingBody(provider, slots[3]!))).status).toBe(201);
  });

  it('rolls back the patient, consent and appointment when a later step fails', async () => {
    const provider = await createLiveProvider();
    const email = unique('rollback@test.local');
    const [ start ] = await slotsOn(provider);
    failConsent.on = true;

    const res = await postBooking(sessionFor(provider.id, email), bookingBody(provider, start!));

    expect(res.status).toBe(500);
    expect(await patientByEmail(provider.id, email)).toHaveLength(0);
    expect(await appointmentsOf(provider.id)).toHaveLength(0);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { userId: provider.id, source: ActionSource.PUBLIC_PORTAL } })).toBe(0);
  });

  it('requires a session and the CSRF header, and answers as an unknown provider in approval mode', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotsOn(provider);
    const session = sessionFor(provider.id, unique('guard@test.local'));

    expect((await postBooking(session, bookingBody(provider, start!), null)).status).toBe(403);
    const anonymous = await request(app).post('/v1/portal/bookings')
      .set('Origin', ALLOWED_ORIGIN).send(bookingBody(provider, start!));
    expect(anonymous.status).toBe(401);
    const foreign = await request(app).post('/v1/portal/bookings')
      .set('Origin', 'https://evil.example').set('Cookie', session.cookie).set('X-CSRF-Token', session.csrf)
      .send(bookingBody(provider, start!));
    expect(foreign.status).toBe(403);

    await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });
    const approval = await postBooking(session, bookingBody(provider, start!));
    expect({ status: approval.status, error: approval.body.error }).toEqual({ status: 404, error: 'Provider not found' });
    expect(await appointmentsOf(provider.id)).toHaveLength(0);
  });
});

describe('GET /v1/portal/appointments', () => {
  const shapeOf = (data: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(data).map(([ k, v ]) => [ k, Array.isArray(v) ? 'array' : typeof v ]));

  it('answers the same shape for none, unavailable and unconsented patients', async () => {
    const provider = await createLiveProvider();
    const revoked = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: revoked.id }, data: { portalAccessEnabled: false } });
    const unconsented = await createTestPatient(provider.id);

    for (const email of [ unique('nadie@test.local'), revoked.email!, unconsented.email! ]) {
      const res = await getAppointments(sessionFor(provider.id, email));
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.data).toEqual({ appointments: [], consentRequired: true });
    }
  });

  it('lists only the session patient\'s upcoming active appointments, soonest first', async () => {
    const provider = await createLiveProvider();
    const other = await createLiveProvider();
    const email = unique('lista@test.local');
    const session = sessionFor(provider.id, email);
    const slots = await slotsOn(provider);

    const second = await postBooking(session, bookingBody(provider, slots[4]!));
    const first = await postBooking(session, bookingBody(provider, slots[1]!));
    // Another patient of the same provider, and the same email at another provider.
    await postBooking(sessionFor(provider.id, unique('otra@test.local')), bookingBody(provider, slots[6]!));
    const [ otherStart ] = await slotsOn(other);
    await postBooking(sessionFor(other.id, email), bookingBody(other, otherStart!));

    const [ patient ] = await patientByEmail(provider.id, email);
    await prisma.appointment.createMany({
      data: [
        { userId: provider.id, patientId: patient!.id, startAt: new Date(slots[8]!), endAt: new Date(slots[9]!), price: 0, status: AppointmentStatus.CANCELLED },
        { userId: provider.id, patientId: patient!.id, startAt: new Date(Date.now() - 2 * 3600_000), endAt: new Date(Date.now() - 3600_000), price: 0 },
      ],
    });

    const res = await getAppointments(session);
    expect(res.status).toBe(200);
    expect(shapeOf(res.body.data)).toEqual({ appointments: 'array', consentRequired: 'boolean' });
    expect(res.body.data.consentRequired).toBe(false);
    expect(res.body.data.appointments.map((a: { id: string }) => a.id)).toEqual([
      first.body.data.appointment.id,
      second.body.data.appointment.id,
    ]);
    expect(res.body.data.appointments[0]).toEqual(first.body.data.appointment);
  });

  it('requires a session', async () => {
    expect((await request(app).get('/v1/portal/appointments')).status).toBe(401);
  });
});
