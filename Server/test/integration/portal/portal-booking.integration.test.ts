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

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  send: vi.fn(),
}));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: () => ({ send: mocks.send }) }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { emailHash } from '../../../src/utils/encryption/blind-index.js';
import { publicBookingService } from '../../../src/public-booking/public-booking.service.js';
import {
  ActionSource,
  AppointmentStatus,
  BookingRequestKind,
  BookingRequestStatus,
  Channel,
  EntityType,
  PatientStatus,
  PortalReminderTiming,
  RecordSource,
} from '../../../generated/prisma/enums.js';
import { createTestPatient, unique } from '../helpers.js';
import {
  PORTAL_ZONE, bookViaConfirmation, buildPortalApp, createLiveProvider, sessionFor, slotStarts,
  type LiveProvider, type TestSession,
} from './portal-helpers.js';

const ZONE = PORTAL_ZONE;

let app: express.Express;
const portal = config.portal as { patientEnabled: boolean; selfServe: boolean };
const portalWas = { ...portal };
beforeAll(() => { portal.patientEnabled = true; portal.selfServe = true; });
afterAll(() => { portal.patientEnabled = portalWas.patientEnabled; portal.selfServe = portalWas.selfServe; });
const scheduler = config.scheduler as { enabled: boolean };
const schedulerWas = scheduler.enabled;
afterAll(() => { scheduler.enabled = schedulerWas; });
beforeEach(() => {
  app = buildPortalApp();
  failConsent.on = false;
  scheduler.enabled = false;
  mocks.dispatch.mockReset().mockResolvedValue({ success: true, messageSid: 'msg-1' });
  mocks.send.mockReset().mockResolvedValue('job-1');
});

const getAppointments = (s: TestSession) =>
  request(app).get('/v1/portal/appointments').set('Cookie', s.cookie);

const patientByEmail = (userId: string, email: string) =>
  prisma.patient.findMany({ where: { userId, emailHash: emailHash(email)! } });

const appointmentsOf = (userId: string) =>
  prisma.appointment.findMany({ where: { userId }, orderBy: { startAt: 'asc' } });

describe('a booking confirmed through its link', () => {
  it('creates the patient, consent and a CONFIRMED portal appointment, audited and linked to the new patient', async () => {
    const provider = await createLiveProvider({ price: 150000 });
    const email = unique('nueva@test.local');
    const [ start ] = await slotStarts(provider);

    const { appointmentId, row } = await bookViaConfirmation(provider, start!, { email });

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
      id: appointmentId,
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
    expect(row).toMatchObject({ status: BookingRequestStatus.APPROVED, patientId: patient!.id });

    expect(await prisma.patientConsent.count({ where: { patientId: patient!.id } })).toBe(1);
    const audits = await prisma.auditLog.findMany({ where: { userId: provider.id, source: ActionSource.PUBLIC_PORTAL } });
    expect(audits.map((a) => a.entityType).sort()).toEqual([
      EntityType.APPOINTMENT, EntityType.BOOKING_REQUEST, EntityType.PATIENT, EntityType.PATIENT_CONSENT, EntityType.REMINDER, EntityType.REMINDER,
    ].sort());
    expect(new Set(audits.map((a) => a.portalPatientId))).toEqual(new Set([ patient!.id ]));
  });

  it('answers a neutral 409 for revoked portal access, releases the hold and writes nothing', async () => {
    const provider = await createLiveProvider();
    const [ start ] = await slotStarts(provider);
    const revoked = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: revoked.id }, data: { portalAccessEnabled: false } });
    const revokedInactive = await createTestPatient(provider.id);
    await prisma.patient.update({
      where: { id: revokedInactive.id },
      data: { portalAccessEnabled: false, status: PatientStatus.INACTIVE },
    });
    // Revoked first, then deleted: deletion must not turn the block into a reviewable request.
    const revokedDeleted = await createTestPatient(provider.id);
    await prisma.patient.update({
      where: { id: revokedDeleted.id },
      data: { portalAccessEnabled: false, isDeleted: true, deletedAt: new Date() },
    });

    for (const p of [ revoked, revokedInactive, revokedDeleted ]) {
      await expect(bookViaConfirmation(provider, start!, { email: p.email! })).rejects.toMatchObject({
        errorCode: 409, message: 'Online booking unavailable',
      });
    }
    expect(await appointmentsOf(provider.id)).toHaveLength(0);
    const rows = await prisma.bookingRequest.findMany({ where: { userId: provider.id } });
    expect(rows.map((r) => [ r.status, r.confirmedAt ])).toEqual([ [ 'CANCELLED', null ], [ 'CANCELLED', null ], [ 'CANCELLED', null ] ]);
    expect(await prisma.patient.count({ where: { userId: provider.id } })).toBe(3);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
  });

  it('routes inactive and deleted-only matches to a REVIEW request and touches no patient (6.6)', async () => {
    const provider = await createLiveProvider();
    const starts = await slotStarts(provider);
    const inactive = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: inactive.id }, data: { status: PatientStatus.INACTIVE } });
    const deleted = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: deleted.id }, data: { isDeleted: true, deletedAt: new Date() } });

    for (const [ i, p ] of [ inactive, deleted ].entries()) {
      const { row, appointmentId } = await bookViaConfirmation(provider, starts[i]!, { email: p.email! });
      expect(appointmentId).toBeNull();
      expect(row).toMatchObject({ kind: BookingRequestKind.REVIEW, status: BookingRequestStatus.PENDING, email: p.email });
      expect(row.confirmedAt).not.toBeNull();
    }
    expect(await appointmentsOf(provider.id)).toHaveLength(0);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
    const after = await prisma.patient.findMany({ where: { userId: provider.id }, orderBy: { createdAt: 'asc' } });
    expect(after.map((p) => [ p.status, p.isDeleted ])).toEqual([ [ PatientStatus.INACTIVE, false ], [ PatientStatus.ACTIVE, true ] ]);
  });

  it('caps a patient at 3 upcoming portal bookings; provider-created, cancelled and past ones do not count', async () => {
    const provider = await createLiveProvider();
    const email = unique('tope@test.local');
    const slots = await slotStarts(provider);

    for (const start of slots.slice(0, 3)) await bookViaConfirmation(provider, start, { email });
    await expect(bookViaConfirmation(provider, slots[3]!, { email })).rejects.toMatchObject({
      errorCode: 409, message: 'Booking limit reached',
    });

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

    expect((await bookViaConfirmation(provider, slots[3]!, { email })).appointmentId).not.toBeNull();
  });

  it('rolls back the patient, consent and appointment when a later step fails, and sends nothing', async () => {
    const provider = await createLiveProvider();
    const email = unique('rollback@test.local');
    const [ start ] = await slotStarts(provider);
    failConsent.on = true;

    await expect(bookViaConfirmation(provider, start!, { email })).rejects.toThrow('consent write failed');

    expect(await patientByEmail(provider.id, email)).toHaveLength(0);
    expect(await appointmentsOf(provider.id)).toHaveLength(0);
    expect(await prisma.patientConsent.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.auditLog.count({
      where: { userId: provider.id, entityType: { in: [ EntityType.PATIENT, EntityType.PATIENT_CONSENT, EntityType.APPOINTMENT, EntityType.REMINDER ] } },
    })).toBe(0);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(await prisma.reminder.count({ where: { userId: provider.id } })).toBe(0);
    expect(await prisma.bookingRequest.count({ where: { userId: provider.id, status: BookingRequestStatus.UNCONFIRMED } })).toBe(1);
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
      expect(res.body.data).toEqual({ appointments: [], requests: [], consentRequired: true });
    }
  });

  it('lists only the session patient\'s upcoming active appointments, soonest first', async () => {
    const provider = await createLiveProvider();
    const other = await createLiveProvider();
    const email = unique('lista@test.local');
    const session = sessionFor(provider.id, email);
    const slots = await slotStarts(provider);

    const second = await bookViaConfirmation(provider, slots[4]!, { email });
    const first = await bookViaConfirmation(provider, slots[1]!, { email });
    await bookViaConfirmation(provider, slots[6]!, { email: unique('otra@test.local') });
    const [ otherStart ] = await slotStarts(other);
    await bookViaConfirmation(other, otherStart!, { email });

    const [ patient ] = await patientByEmail(provider.id, email);
    await prisma.appointment.createMany({
      data: [
        { userId: provider.id, patientId: patient!.id, startAt: new Date(slots[8]!), endAt: new Date(slots[9]!), price: 0, status: AppointmentStatus.CANCELLED },
        { userId: provider.id, patientId: patient!.id, startAt: new Date(Date.now() - 2 * 3600_000), endAt: new Date(Date.now() - 3600_000), price: 0 },
      ],
    });

    const res = await getAppointments(session);
    expect(res.status).toBe(200);
    expect(shapeOf(res.body.data)).toEqual({ appointments: 'array', requests: 'array', consentRequired: 'boolean' });
    expect(res.body.data.consentRequired).toBe(false);
    expect(res.body.data.appointments.map((a: { id: string }) => a.id)).toEqual([ first.appointmentId, second.appointmentId ]);
    const dto = res.body.data.appointments[0];
    expect(Object.keys(dto).sort()).toEqual([
      'canCancel', 'canReschedule', 'durationMinutes', 'endUtc', 'id', 'location', 'meeting', 'price', 'startUtc', 'status', 'type',
    ]);
    expect(dto.meeting).toBeNull();
    expect(dto).toMatchObject({ startUtc: slots[1], durationMinutes: 60, status: 'CONFIRMED', canCancel: true, canReschedule: true });
    expect(Object.keys(dto.type)).toEqual([ 'name' ]);
    expect(Object.keys(dto.location).sort()).toEqual([ 'address', 'instructions', 'isVirtual', 'name' ]);
  });

  it('requires a session', async () => {
    expect((await request(app).get('/v1/portal/appointments')).status).toBe(401);
  });
});

describe('booking confirmation, reminder and provider notice', () => {
  const MADRID = 'Europe/Madrid';
  const fmt = (iso: string, timeZone: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('es-ES', { ...opts, timeZone }).format(new Date(iso));
  const timeIn = (iso: string, timeZone: string) => fmt(iso, timeZone, { hour: '2-digit', minute: '2-digit', hour12: true });

  async function soonestSlotWithin24h(provider: LiveProvider, minHours = 0): Promise<string> {
    const today = DateTime.now().setZone(ZONE);
    const { slots } = await publicBookingService.getSlots(provider.slug, {
      typeId: provider.typeId, from: today.toISODate()!, to: today.plus({ days: 1 }).toISODate()!,
    });
    const soon = slots.find((s) => {
      const ahead = new Date(s.startUtc).getTime() - Date.now();
      return ahead >= minHours * 3600_000 && ahead < 23 * 3600_000;
    });
    return soon!.startUtc;
  }

  it('sends the patient a confirmation in their own zone after commit when the scheduler is off', async () => {
    const provider = await createLiveProvider();
    const email = unique('confirma@test.local');
    const [ start ] = await slotStarts(provider);

    await bookViaConfirmation(provider, start!, { email, patientTimezone: MADRID });

    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    const [ channel, opts ] = mocks.dispatch.mock.calls[0]!;
    expect(channel).toBe(Channel.EMAIL);
    expect(opts.to).toBe(email);
    expect(opts.subject).toMatch(/^Cita confirmada con /);
    expect(opts.body).toContain(timeIn(start!, MADRID));
    expect(opts.body).toContain(`(hora de ${MADRID})`);
    expect(opts.body).not.toContain(timeIn(start!, ZONE));
    expect(opts.body).toContain(`${config.portal.url}/book/${provider.slug}/appointments`);
  });

  it('notifies the provider on their channel without patient details', async () => {
    const provider = await createLiveProvider();
    await prisma.user.update({
      where: { id: provider.id },
      data: { reminderActive: true, reminderChannel: Channel.WHATSAPP, whatsappNumber: '+573009998877' },
    });
    const [ start ] = await slotStarts(provider);

    await bookViaConfirmation(provider, start!, { email: unique('aviso@test.local') });

    expect(mocks.dispatch).toHaveBeenCalledTimes(2);
    const [ channel, opts ] = mocks.dispatch.mock.calls[1]!;
    expect(channel).toBe(Channel.WHATSAPP);
    expect(opts).toEqual({
      to: '+573009998877',
      contentSid: config.twilio.portalBookingSid,
      contentVariables: { '1': expect.any(String), '2': expect.any(String), '3': timeIn(start!, ZONE) },
    });
    expect(JSON.stringify(opts)).not.toMatch(/Lucia|Rojas/);
  });

  it('keeps the booking when a notification fails after commit', async () => {
    const provider = await createLiveProvider();
    mocks.dispatch.mockResolvedValue({ success: false, error: 'Brevo down' });
    const [ start ] = await slotStarts(provider);

    const { appointmentId } = await bookViaConfirmation(provider, start!, { email: unique('caido@test.local') });

    expect(appointmentId).not.toBeNull();
    expect(await appointmentsOf(provider.id)).toHaveLength(1);
  });

  it('queues both notifications and the reminder inside the transaction when the scheduler is on', async () => {
    const provider = await createLiveProvider();
    scheduler.enabled = true;
    const [ start ] = await slotStarts(provider);

    const { appointmentId } = await bookViaConfirmation(provider, start!, { email: unique('cola@test.local') });

    expect(mocks.dispatch).not.toHaveBeenCalled();
    const reminder = await prisma.reminder.findUniqueOrThrow({ where: { appointmentId: appointmentId! } });
    expect(mocks.send.mock.calls).toEqual([
      [ 'send-reminder', { reminderId: reminder.id }, { db: expect.anything(), startAfter: reminder.sendAt } ],
      [ 'portal-booking-notify', { appointmentId, kind: 'patient-confirmation' }, { db: expect.anything() } ],
      [ 'portal-booking-notify', { appointmentId, kind: 'provider-notice' }, { db: expect.anything() } ],
    ]);
  });

  it('schedules an EMAIL reminder 24h before, written in the patient zone', async () => {
    const provider = await createLiveProvider();
    const email = unique('recuerda@test.local');
    const [ start ] = await slotStarts(provider);

    const { appointmentId } = await bookViaConfirmation(provider, start!, { email, patientTimezone: MADRID });

    const reminder = await prisma.reminder.findUniqueOrThrow({ where: { appointmentId: appointmentId! } });
    expect(reminder).toMatchObject({ channel: Channel.EMAIL, to: email, sendMode: 'SCHEDULED', status: 'PENDING', subject: 'Recordatorio de cita' });
    expect(reminder.sendAt.getTime()).toBe(new Date(start!).getTime() - 24 * 3600_000);
    expect(reminder.body).toContain(`Hora: ${timeIn(start!, MADRID)}`);
  });

  it('skips the reminder when the appointment is less than 24h away', async () => {
    const provider = await createLiveProvider();
    const start = await soonestSlotWithin24h(provider);

    const { appointmentId } = await bookViaConfirmation(provider, start, { email: unique('pronto@test.local') });

    expect(await prisma.reminder.count({ where: { appointmentId: appointmentId! } })).toBe(0);
  });

  it('uses the provider preset, so a short-notice booking still gets its reminder', async () => {
    const provider = await createLiveProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { portalReminderTiming: PortalReminderTiming.ONE_HOUR_BEFORE } });
    const start = await soonestSlotWithin24h(provider, 2);

    const { appointmentId } = await bookViaConfirmation(provider, start, { email: unique('corto@test.local') });

    const reminder = await prisma.reminder.findUniqueOrThrow({ where: { appointmentId: appointmentId! } });
    expect(reminder.sendAt.getTime()).toBe(new Date(start).getTime() - 3600_000);
  });

  it('places a clock preset at that wall-clock time in the patient zone', async () => {
    const provider = await createLiveProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { portalReminderTiming: PortalReminderTiming.PREVIOUS_DAY_EVENING } });
    const [ start ] = await slotStarts(provider);

    const { appointmentId } = await bookViaConfirmation(provider, start!, { email: unique('tarde@test.local'), patientTimezone: MADRID });

    const reminder = await prisma.reminder.findUniqueOrThrow({ where: { appointmentId: appointmentId! } });
    const local = DateTime.fromJSDate(reminder.sendAt, { zone: MADRID });
    expect(local.toISODate()).toBe(DateTime.fromISO(start!, { zone: MADRID }).minus({ days: 1 }).toISODate());
    expect([ local.hour, local.minute ]).toEqual([ 18, 0 ]);
  });

  it('creates no reminder when the provider chose none', async () => {
    const provider = await createLiveProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { portalReminderTiming: PortalReminderTiming.NONE } });
    const [ start ] = await slotStarts(provider);

    const { appointmentId } = await bookViaConfirmation(provider, start!, { email: unique('apagado@test.local') });

    expect(await prisma.reminder.count({ where: { appointmentId: appointmentId! } })).toBe(0);
  });
});
