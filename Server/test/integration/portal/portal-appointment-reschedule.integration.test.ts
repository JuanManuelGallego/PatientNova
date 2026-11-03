import type express from 'express';
import request from 'supertest';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), send: vi.fn() }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: () => ({ send: mocks.send }) }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import { publicBookingService } from '../../../src/public-booking/public-booking.service.js';
import {
  ActionSource,
  AppointmentStatus,
  BookingApprovalMode,
  Channel,
  EntityType,
  ReminderStatus,
} from '../../../generated/prisma/enums.js';
import { createTestAppointmentType, unique } from '../helpers.js';
import {
  ALLOWED_ORIGIN,
  buildPortalApp,
  createConsentedPatient,
  createLiveProvider,
  PORTAL_ZONE,
  portalBookingBody,
  sessionFor,
  portalPost,
  slotStarts,
  type LiveProvider,
  type TestSession,
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
});

const HOUR = 3600_000;

const postBooking = (s: TestSession, body: object) => portalPost(app, '/v1/portal/bookings', s, body);

const postReschedule = (s: TestSession, id: string, body: object, opts: { csrf?: string | null; origin?: string } = {}) =>
  portalPost(app, `/v1/portal/appointments/${id}/reschedule`, s, body, opts);

const moveTo = (startUtc: string, patientTimezone = 'Europe/Madrid') => ({ startUtc, patientTimezone });

async function bookAt(provider: LiveProvider, startUtc: string, email = unique('mueve@test.local')) {
  const session = sessionFor(provider.id, email);
  const res = await postBooking(session, portalBookingBody(provider, startUtc));
  expect(res.status).toBe(201);
  return { session, appointmentId: res.body.data.appointment.id as string };
}

async function slotsWithin24h(provider: LiveProvider): Promise<string[]> {
  const today = DateTime.now().setZone(PORTAL_ZONE);
  const { slots } = await publicBookingService.getSlots(provider.slug, {
    typeId: provider.typeId, from: today.toISODate()!, to: today.plus({ days: 1 }).toISODate()!,
  });
  return slots.map((s) => s.startUtc).filter((s) => new Date(s).getTime() - Date.now() < 23 * HOUR);
}

const appointment = (id: string) => prisma.appointment.findUniqueOrThrow({ where: { id } });

describe('POST /v1/portal/appointments/:id/reschedule', () => {
  it('moves the booking in place: same id, new times, type duration, price and status kept, audited, notified', async () => {
    const provider = await createLiveProvider({ price: 150000 });
    await prisma.user.update({ where: { id: provider.id }, data: { reminderActive: true, reminderChannel: Channel.EMAIL } });
    const [ from ] = await slotStarts(provider, 3);
    const [ , to ] = await slotStarts(provider, 4);
    const { session, appointmentId } = await bookAt(provider, from!);
    const before = await appointment(appointmentId);
    mocks.dispatch.mockClear();
    const since = new Date();

    const res = await postReschedule(session, appointmentId, moveTo(to!));

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.appointment).toMatchObject({
      id: appointmentId, startUtc: to, durationMinutes: 60, status: 'CONFIRMED', price: 150000, canCancel: true, canReschedule: true,
    });
    const after = await appointment(appointmentId);
    expect(after.startAt.toISOString()).toBe(to);
    expect(after.endAt.getTime() - after.startAt.getTime()).toBe(HOUR);
    expect(after).toMatchObject({ status: AppointmentStatus.CONFIRMED, price: 150000, patientTimezone: 'Europe/Madrid' });
    expect(after.confirmedAt).toEqual(before.confirmedAt);

    expect(await slotStarts(provider, 3)).toContain(from);
    expect(await slotStarts(provider, 4)).not.toContain(to);

    const audits = await prisma.auditLog.findMany({
      where: { entityId: appointmentId, source: ActionSource.PUBLIC_PORTAL, eventTimeUtc: { gte: since } },
    });
    expect(audits.map((a) => `${a.entityType}:${a.actionType}`)).toEqual([ `${EntityType.APPOINTMENT}:UPDATE` ]);

    expect(mocks.dispatch).toHaveBeenCalledTimes(2);
    const toPatient = mocks.dispatch.mock.calls[0]![1];
    const toProvider = mocks.dispatch.mock.calls[1]![1];
    expect(toPatient).toMatchObject({ to: session.email, subject: expect.stringMatching(/^Cita reprogramada con /) });
    expect(toPatient.body).toContain('(hora de Europe/Madrid)');
    expect(toPatient.body).toContain('Fecha anterior:');
    expect(toProvider).toMatchObject({ subject: 'Cita reprogramada en línea' });
    expect(toProvider.body).toMatch(/Antes: .*\nAhora: /);
  });

  it('moves the pending reminder with the appointment and rewrites it for the new time', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const [ to ] = await slotStarts(provider, 5);
    const { session, appointmentId } = await bookAt(provider, from!);
    const reminder = await prisma.reminder.findUniqueOrThrow({ where: { appointmentId } });

    expect((await postReschedule(session, appointmentId, moveTo(to!))).status).toBe(200);

    const moved = await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } });
    expect(moved).toMatchObject({ appointmentId, status: ReminderStatus.PENDING });
    expect(moved.sendAt.getTime()).toBe(new Date(to!).getTime() - 24 * HOUR);
    expect(moved.body).not.toBe(reminder.body);
  });

  it('keeps a pending reminder channel and address when the provider changed them', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const [ to ] = await slotStarts(provider, 5);
    const { session, appointmentId } = await bookAt(provider, from!);
    const reminder = await prisma.reminder.update({
      where: { appointmentId }, data: { channel: Channel.SMS, to: '+573001112233' },
    });

    expect((await postReschedule(session, appointmentId, moveTo(to!))).status).toBe(200);

    const moved = await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } });
    expect(moved).toMatchObject({ appointmentId, status: ReminderStatus.PENDING, channel: Channel.SMS, to: '+573001112233' });
    expect(moved.sendAt.getTime()).toBe(new Date(to!).getTime() - 24 * HOUR);
  });

  it('cancels the pending reminder when the new time is less than 24h away', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const { session, appointmentId } = await bookAt(provider, from!);
    const reminder = await prisma.reminder.findUniqueOrThrow({ where: { appointmentId } });
    const [ soon ] = await slotsWithin24h(provider);

    expect((await postReschedule(session, appointmentId, moveTo(soon!))).status).toBe(200);

    expect(await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).toMatchObject({
      status: ReminderStatus.CANCELLED, appointmentId: null,
    });
  });

  it('never rewrites a sent reminder: it is unlinked and a new one is linked', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const [ to ] = await slotStarts(provider, 6);
    const { session, appointmentId } = await bookAt(provider, from!);
    const sent = await prisma.reminder.update({
      where: { appointmentId }, data: { status: ReminderStatus.SENT, sentAt: new Date() },
    });

    expect((await postReschedule(session, appointmentId, moveTo(to!))).status).toBe(200);

    expect(await prisma.reminder.findUniqueOrThrow({ where: { id: sent.id } })).toMatchObject({
      status: ReminderStatus.SENT, appointmentId: null, sendAt: sent.sendAt,
    });
    const fresh = await prisma.reminder.findUniqueOrThrow({ where: { appointmentId } });
    expect(fresh.id).not.toBe(sent.id);
    const audits = await prisma.auditLog.findMany({ where: { entityType: EntityType.REMINDER, entityId: sent.id, actionType: 'UPDATE' } });
    // The booking wrote the "linked" row; the move adds exactly one "unlinked" row.
    expect(audits.filter((a) => (a.fieldsAfter as { appointmentId?: string | null }).appointmentId === null)).toEqual([
      expect.objectContaining({ source: ActionSource.PUBLIC_PORTAL, affectedFields: [ 'appointmentId' ], fieldsBefore: { appointmentId } }),
    ]);
    expect(fresh).toMatchObject({ status: ReminderStatus.PENDING, channel: Channel.EMAIL, to: session.email });
    expect(fresh.sendAt.getTime()).toBe(new Date(to!).getTime() - 24 * HOUR);
  });

  it('adds a reminder when a booking made under 24h ahead moves further out', async () => {
    const provider = await createLiveProvider();
    const [ soon ] = await slotsWithin24h(provider);
    const [ to ] = await slotStarts(provider, 4);
    const { session, appointmentId } = await bookAt(provider, soon!);
    expect(await prisma.reminder.count({ where: { appointmentId } })).toBe(0);

    expect((await postReschedule(session, appointmentId, moveTo(to!))).status).toBe(200);

    expect((await prisma.reminder.findUniqueOrThrow({ where: { appointmentId } })).status).toBe(ReminderStatus.PENDING);
  });

  it('may move right next to its own old time: the appointment never blocks itself through the buffer', async () => {
    const provider = await createLiveProvider({ bufferMinutes: 30 });
    const starts = await slotStarts(provider, 3);
    const { session, appointmentId } = await bookAt(provider, starts[2]!);

    const res = await postReschedule(session, appointmentId, moveTo(starts[3]!));

    expect(res.status).toBe(200);
    expect((await appointment(appointmentId)).startAt.toISOString()).toBe(starts[3]);
  });

  it('lets exactly one of a reschedule and a booking of the same slot win', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const [ target ] = await slotStarts(provider, 4);
    const { session, appointmentId } = await bookAt(provider, from!);

    const [ moved, booked ] = await Promise.all([
      postReschedule(session, appointmentId, moveTo(target!)),
      postBooking(sessionFor(provider.id, unique('rival@test.local')), portalBookingBody(provider, target!)),
    ]);

    // The winner answers 200 (moved) or 201 (booked); the loser gets the one neutral 409.
    expect([ moved.status === 200, booked.status === 201 ].filter(Boolean)).toHaveLength(1);
    expect([ moved.status, booked.status ]).toContain(409);
    expect(await prisma.appointment.count({
      where: { userId: provider.id, startAt: new Date(target!), status: { in: [ AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED ] } },
    })).toBe(1);
    if (moved.status === 409) expect((await appointment(appointmentId)).startAt.toISOString()).toBe(from);
  });

  it('refuses times the slot engine would not offer with one 409 that never shows the other appointment', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const day4 = await slotStarts(provider, 4);
    const { session, appointmentId } = await bookAt(provider, from!);
    const taken = await bookAt(provider, day4[1]!, unique('ocupa@test.local'));
    expect(taken.appointmentId).toBeDefined();
    await prisma.blockedTime.create({
      data: { userId: provider.id, startTimeUtc: new Date(day4[3]!), endTimeUtc: new Date(new Date(day4[3]!).getTime() + HOUR), description: 'Almuerzo' },
    });
    const offGrid = new Date(new Date(day4[5]!).getTime() + 15 * 60_000).toISOString();
    const beyondHorizon = DateTime.now().setZone(PORTAL_ZONE).plus({ days: 45 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO()!;
    const past = DateTime.now().setZone(PORTAL_ZONE).minus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO()!;

    for (const startUtc of [ day4[1]!, day4[3]!, offGrid, beyondHorizon, past ]) {
      const res = await postReschedule(session, appointmentId, moveTo(startUtc));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Slot no longer available');
      expect(JSON.stringify(res.body)).not.toContain(day4[1]!.slice(0, 16));
    }
    expect((await appointment(appointmentId)).startAt.toISOString()).toBe(from);
  });

  it('answers 400 for the same start', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const { session, appointmentId } = await bookAt(provider, from!);
    const res = await postReschedule(session, appointmentId, moveTo(from!));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('New time must differ from the current one');
  });

  it('refuses provider-created appointments and bookings whose type stopped being bookable', async () => {
    const provider = await createLiveProvider();
    const patient = await createConsentedPatient(provider.id);
    const session = sessionFor(provider.id, patient.email!);
    const [ , to ] = await slotStarts(provider, 4);
    const start = new Date(Date.now() + 5 * 86_400_000);
    const created = await prisma.appointment.create({
      data: {
        userId: provider.id, patientId: patient.id, typeId: provider.typeId, locationId: provider.locationId,
        startAt: start, endAt: new Date(start.getTime() + HOUR), price: 0, status: AppointmentStatus.SCHEDULED,
      },
    });
    const providerCreated = await postReschedule(session, created.id, moveTo(to!));
    expect(providerCreated.status).toBe(409);
    expect(providerCreated.body.error).toBe('Reschedule unavailable');

    const [ from ] = await slotStarts(provider, 3);
    const booked = await bookAt(provider, from!);
    const spare = await createTestAppointmentType(provider.id);
    await prisma.appointmentType.update({ where: { id: spare.id }, data: { bookableOnline: true } });
    await prisma.appointmentType.update({ where: { id: provider.typeId }, data: { bookableOnline: false } });
    const notBookable = await postReschedule(booked.session, booked.appointmentId, moveTo(to!));
    expect(notBookable.status).toBe(409);
    expect(notBookable.body.error).toBe('Reschedule unavailable');
  });

  it('answers as an unknown provider in approval mode', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const [ to ] = await slotStarts(provider, 4);
    const { session, appointmentId } = await bookAt(provider, from!);
    await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });

    const res = await postReschedule(session, appointmentId, moveTo(to!));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Provider not found');
  });

  it('answers as an unknown provider while booking is paused (cancel still works)', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const [ to ] = await slotStarts(provider, 4);
    const { session, appointmentId } = await bookAt(provider, from!);
    await prisma.user.update({ where: { id: provider.id }, data: { bookingEnabled: false } });

    const res = await postReschedule(session, appointmentId, moveTo(to!));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Provider not found');
    expect((await appointment(appointmentId)).startAt.toISOString()).toBe(from);
  });

  it('allows the provider\'s number of reschedules per appointment, counting only successful patient moves', async () => {
    const provider = await createLiveProvider();
    const [ a, b, c ] = await slotStarts(provider, 3);
    const { session, appointmentId } = await bookAt(provider, a!);

    expect((await postReschedule(session, appointmentId, moveTo(a!))).status).toBe(400);
    expect((await appointment(appointmentId)).patientRescheduleCount).toBe(0);

    const first = await postReschedule(session, appointmentId, moveTo(b!));
    expect(first.status).toBe(200);
    expect(first.body.data.appointment.canReschedule).toBe(true);
    const second = await postReschedule(session, appointmentId, moveTo(c!));
    expect(second.status).toBe(200);
    expect(second.body.data.appointment.canReschedule).toBe(false);
    expect((await appointment(appointmentId)).patientRescheduleCount).toBe(2);

    const third = await postReschedule(session, appointmentId, moveTo(a!));
    expect(third.status).toBe(409);
    expect(third.body.error).toBe('Reschedule unavailable');
    expect((await appointment(appointmentId)).startAt.toISOString()).toBe(c);

    const end = new Date(new Date(a!).getTime() + HOUR).toISOString();
    await appointmentService.update(appointmentId, { startAt: a!, endAt: end }, provider.id);
    expect((await appointment(appointmentId)).patientRescheduleCount).toBe(2);
  });

  it('refuses every reschedule when the provider allows none', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const [ to ] = await slotStarts(provider, 4);
    const { session, appointmentId } = await bookAt(provider, from!);
    await prisma.user.update({ where: { id: provider.id }, data: { maxPatientReschedules: 0 } });

    const res = await postReschedule(session, appointmentId, moveTo(to!));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Reschedule unavailable');
  });

  it('refuses once the current start is within the provider\'s minimum notice', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const [ to ] = await slotStarts(provider, 4);
    const { session, appointmentId } = await bookAt(provider, from!);
    const hoursAway = Math.floor((new Date(from!).getTime() - Date.now()) / HOUR);

    await prisma.user.update({ where: { id: provider.id }, data: { minRescheduleNoticeHours: hoursAway + 1 } });
    const tooLate = await postReschedule(session, appointmentId, moveTo(to!));
    expect(tooLate.status).toBe(409);
    expect(tooLate.body.error).toBe('Reschedule unavailable');

    await prisma.user.update({ where: { id: provider.id }, data: { minRescheduleNoticeHours: hoursAway - 1 } });
    expect((await postReschedule(session, appointmentId, moveTo(to!))).status).toBe(200);
  });

  it('answers the cancel 404 for appointments that are not the patient\'s upcoming active ones', async () => {
    const provider = await createLiveProvider();
    const [ a, b ] = await slotStarts(provider, 3);
    const [ to ] = await slotStarts(provider, 4);
    const mine = await bookAt(provider, a!);
    const theirs = await bookAt(provider, b!, unique('ajena@test.local'));
    await appointmentService.setStatus(mine.appointmentId, provider.id, AppointmentStatus.CANCELLED);

    for (const id of [ theirs.appointmentId, mine.appointmentId, '00000000-0000-4000-8000-000000000000' ]) {
      const res = await postReschedule(mine.session, id, moveTo(to!));
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Appointment not found');
    }
  });

  it('queues the reminder and both notices on the transaction, and rolls back on a later failure', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const [ to ] = await slotStarts(provider, 4);
    const { session, appointmentId } = await bookAt(provider, from!);
    const reminder = await prisma.reminder.findUniqueOrThrow({ where: { appointmentId } });
    scheduler.enabled = true;
    mocks.dispatch.mockClear();

    mocks.send.mockImplementation(async (queue: string) => {
      if (queue === 'portal-booking-notify') throw new Error('queue down');
      return 'job-1';
    });
    expect((await postReschedule(session, appointmentId, moveTo(to!))).status).toBe(500);
    expect((await appointment(appointmentId)).startAt.toISOString()).toBe(from);
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).sendAt).toEqual(reminder.sendAt);
    expect((await appointment(appointmentId)).patientRescheduleCount).toBe(0);

    mocks.send.mockReset().mockResolvedValue('job-1');
    expect((await postReschedule(session, appointmentId, moveTo(to!))).status).toBe(200);
    const sendAt = new Date(new Date(to!).getTime() - 24 * HOUR);
    expect(mocks.send.mock.calls).toEqual([
      [ 'send-reminder', { reminderId: reminder.id }, { db: expect.anything(), startAfter: sendAt } ],
      [ 'portal-booking-notify', { appointmentId, kind: 'patient-reschedule', previousStartAt: from, startAt: to }, { db: expect.anything() } ],
      [ 'portal-booking-notify', { appointmentId, kind: 'provider-reschedule-notice', previousStartAt: from, startAt: to }, { db: expect.anything() } ],
    ]);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('requires the session, CSRF, exact Origin, a uuid and a strict body', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const [ to ] = await slotStarts(provider, 4);
    const { session, appointmentId } = await bookAt(provider, from!);

    expect((await request(app).post(`/v1/portal/appointments/${appointmentId}/reschedule`).set('Origin', ALLOWED_ORIGIN).send(moveTo(to!))).status).toBe(401);
    expect((await postReschedule(session, appointmentId, moveTo(to!), { csrf: null })).status).toBe(403);
    expect((await postReschedule(session, appointmentId, moveTo(to!), { origin: 'https://evil.example' })).status).toBe(403);
    expect((await postReschedule(session, 'not-a-uuid', moveTo(to!))).status).toBe(400);
    for (const extra of [ { endUtc: to }, { typeId: provider.typeId }, { price: 0 } ]) {
      expect((await postReschedule(session, appointmentId, { ...moveTo(to!), ...extra })).status).toBe(400);
    }
    expect((await postReschedule(session, appointmentId, moveTo(to!, 'Mars/Olympus'))).status).toBe(400);
    expect((await postReschedule(session, appointmentId, { startUtc: to })).status).toBe(400);
    expect((await appointment(appointmentId)).startAt.toISOString()).toBe(from);
  });
});

describe('GET /v1/portal/appointments/:id/slots', () => {
  const dayAhead = (days: number) => DateTime.now().setZone(PORTAL_ZONE).plus({ days }).toISODate()!;
  const getSlots = (s: TestSession | null, id: string, query: Record<string, string>) => {
    const req = request(app).get(`/v1/portal/appointments/${id}/slots`).query(query).set('Origin', ALLOWED_ORIGIN);
    if (s) req.set('Cookie', s.cookie);
    return req;
  };
  const startsOf = (res: request.Response) => (res.body.data.slots as Array<{ startUtc: string }>).map((x) => x.startUtc);

  it('offers the times next to the appointment that the public slots hide, without its own start', async () => {
    const provider = await createLiveProvider({ bufferMinutes: 30 });
    const starts = await slotStarts(provider, 3);
    const { session, appointmentId } = await bookAt(provider, starts[2]!);
    const other = await bookAt(provider, starts[5]!, unique('otra@test.local'));
    expect(other.appointmentId).toBeDefined();
    const publicNow = await slotStarts(provider, 3);
    expect(publicNow).not.toContain(starts[1]);
    expect(publicNow).not.toContain(starts[3]);

    const res = await getSlots(session, appointmentId, { from: dayAhead(3), to: dayAhead(3) });

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.timezone).toBe(PORTAL_ZONE);
    const offered = startsOf(res);
    expect(offered).toEqual(expect.arrayContaining([ starts[1], starts[3] ]));
    expect(offered).not.toContain(starts[2]);
    expect(offered).not.toContain(starts[5]);
    expect(offered).not.toContain(starts[4]);
  });

  it('gives the same answers as the move itself: 404 not theirs, 409 not movable, 404 in approval mode', async () => {
    const provider = await createLiveProvider();
    const [ a, b ] = await slotStarts(provider, 3);
    const range = { from: dayAhead(3), to: dayAhead(4) };
    const mine = await bookAt(provider, a!);
    const theirs = await bookAt(provider, b!, unique('ajena@test.local'));

    const notTheirs = await getSlots(mine.session, theirs.appointmentId, range);
    expect(notTheirs.status).toBe(404);
    expect(notTheirs.body.error).toBe('Appointment not found');

    const patient = await createConsentedPatient(provider.id);
    const start = new Date(Date.now() + 5 * 86_400_000);
    const created = await prisma.appointment.create({
      data: {
        userId: provider.id, patientId: patient.id, typeId: provider.typeId, locationId: provider.locationId,
        startAt: start, endAt: new Date(start.getTime() + HOUR), price: 0, status: AppointmentStatus.SCHEDULED,
      },
    });
    const providerCreated = await getSlots(sessionFor(provider.id, patient.email!), created.id, range);
    expect(providerCreated.status).toBe(409);
    expect(providerCreated.body.error).toBe('Reschedule unavailable');

    await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });
    expect((await getSlots(mine.session, mine.appointmentId, range)).status).toBe(404);
  });

  it('requires the session, a uuid and a strict range', async () => {
    const provider = await createLiveProvider();
    const [ from ] = await slotStarts(provider, 3);
    const { session, appointmentId } = await bookAt(provider, from!);

    expect((await getSlots(null, appointmentId, { from: dayAhead(3), to: dayAhead(3) })).status).toBe(401);
    expect((await getSlots(session, 'not-a-uuid', { from: dayAhead(3), to: dayAhead(3) })).status).toBe(400);
    expect((await getSlots(session, appointmentId, { from: dayAhead(4), to: dayAhead(3) })).status).toBe(400);
    expect((await getSlots(session, appointmentId, { from: dayAhead(1), to: dayAhead(40) })).status).toBe(400);
    expect((await getSlots(session, appointmentId, { from: dayAhead(3), to: dayAhead(3), typeId: provider.typeId })).status).toBe(400);
  });
});
