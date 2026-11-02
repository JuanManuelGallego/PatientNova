import type express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  send: vi.fn(),
  findJobs: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({
  getBoss: () => ({ send: mocks.send, findJobs: mocks.findJobs, cancel: mocks.cancel }),
}));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import {
  ActionSource,
  AppointmentStatus,
  BookingApprovalMode,
  CancelledBy,
  Channel,
  EntityType,
  ReminderStatus,
} from '../../../generated/prisma/enums.js';
import { createTestAppointmentType, createTestPatient, unique } from '../helpers.js';
import {
  ALLOWED_ORIGIN,
  buildPortalApp,
  createConsentedPatient,
  createLiveProvider,
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
  mocks.findJobs.mockReset().mockResolvedValue([ { id: 'queued-job' } ]);
  mocks.cancel.mockReset().mockResolvedValue(undefined);
});

const postBooking = (s: TestSession, body: object) => portalPost(app, '/v1/portal/bookings', s, body);

const postCancel = (s: TestSession, id: string, opts: { csrf?: string | null; origin?: string; body?: object } = {}) =>
  portalPost(app, `/v1/portal/appointments/${id}/cancel`, s, opts.body, opts);

const listAppointments = (s: TestSession) => request(app).get('/v1/portal/appointments').set('Cookie', s.cookie);

/** A portal booking three days ahead (so it gets a 24h reminder). */
async function book(provider: LiveProvider, email = unique('cancela@test.local'), slotIndex = 0) {
  const session = sessionFor(provider.id, email);
  const starts = await slotStarts(provider);
  const res = await postBooking(session, portalBookingBody(provider, starts[slotIndex]!));
  expect(res.status).toBe(201);
  return { session, appointmentId: res.body.data.appointment.id as string, start: starts[slotIndex]! };
}

async function providerAppointment(provider: LiveProvider, patientId: string, start: Date, data: Record<string, unknown> = {}) {
  return prisma.appointment.create({
    data: {
      userId: provider.id, patientId, typeId: provider.typeId, locationId: provider.locationId,
      startAt: start, endAt: new Date(start.getTime() + 3600_000), price: 90000, paid: true,
      status: AppointmentStatus.SCHEDULED, ...data,
    },
  });
}

describe('POST /v1/portal/appointments/:id/cancel', () => {
  it('cancels the patient\'s booking: CANCELLED by PATIENT, slot freed, reminder cancelled, audited, notified', async () => {
    const provider = await createLiveProvider();
    await prisma.user.update({ where: { id: provider.id }, data: { reminderActive: true, reminderChannel: Channel.EMAIL } });
    const { session, appointmentId, start } = await book(provider);
    mocks.dispatch.mockClear();
    const before = new Date();

    const res = await postCancel(session, appointmentId);

    expect(res.status).toBe(204);
    expect(res.headers['cache-control']).toBe('no-store');
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(appt).toMatchObject({ status: AppointmentStatus.CANCELLED, cancelledBy: CancelledBy.PATIENT, paid: false });
    expect(appt.cancelledAt).toBeInstanceOf(Date);
    expect(await slotStarts(provider)).toContain(start);

    const reminder = await prisma.reminder.findUniqueOrThrow({ where: { appointmentId } });
    expect(reminder.status).toBe(ReminderStatus.CANCELLED);

    const audits = await prisma.auditLog.findMany({
      where: { userId: provider.id, source: ActionSource.PUBLIC_PORTAL, entityId: { in: [ appointmentId, reminder.id ] }, eventTimeUtc: { gte: before } },
    });
    expect(audits.map((a) => a.entityType).sort()).toEqual([ EntityType.APPOINTMENT, EntityType.REMINDER ]);

    expect(mocks.dispatch).toHaveBeenCalledTimes(2);
    const toPatient = mocks.dispatch.mock.calls[0]![1];
    const toProvider = mocks.dispatch.mock.calls[1]![1];
    expect(toPatient).toMatchObject({ to: session.email, subject: expect.stringMatching(/^Cita cancelada con /) });
    expect(toPatient.body).toContain(`/book/${provider.slug}`);
    expect(toProvider).toMatchObject({ subject: 'Cita cancelada en línea' });
    expect(toProvider.body).toContain('Un paciente canceló en línea su cita del');
    expect(toProvider.body).not.toMatch(/Lucia|Rojas/);

    expect((await listAppointments(session)).body.data.appointments).toEqual([]);
  });

  it('cancels a provider-created appointment too, and only offers reschedule for online bookings', async () => {
    const provider = await createLiveProvider();
    const patient = await createConsentedPatient(provider.id);
    const session = sessionFor(provider.id, patient.email!);
    const created = await providerAppointment(provider, patient.id, new Date(Date.now() + 5 * 86_400_000));

    const [ listed ] = (await listAppointments(session)).body.data.appointments;
    expect(listed).toMatchObject({ id: created.id, canCancel: true, canReschedule: false });

    expect((await postCancel(session, created.id)).status).toBe(204);
    expect(await prisma.appointment.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({
      status: AppointmentStatus.CANCELLED, cancelledBy: CancelledBy.PATIENT, paid: false,
    });
  });

  it('answers one identical 404 for anything that is not the session patient\'s upcoming active appointment', async () => {
    const provider = await createLiveProvider();
    const other = await createLiveProvider();
    const patient = await createConsentedPatient(provider.id);
    const session = sessionFor(provider.id, patient.email!);
    const future = new Date(Date.now() + 5 * 86_400_000);

    const someoneElse = await book(provider, unique('otro@test.local'), 2);
    const otherProvider = await book(other, patient.email!);
    const past = await providerAppointment(provider, patient.id, new Date(Date.now() - 3 * 3600_000));
    const cancelled = await providerAppointment(provider, patient.id, future, { status: AppointmentStatus.CANCELLED });
    const deleted = await providerAppointment(provider, patient.id, new Date(future.getTime() + 2 * 3600_000), { isDeleted: true, deletedAt: new Date() });
    const completed = await providerAppointment(provider, patient.id, new Date(future.getTime() + 4 * 3600_000), { status: AppointmentStatus.COMPLETED });

    const ids = [
      someoneElse.appointmentId, otherProvider.appointmentId, past.id, cancelled.id, deleted.id, completed.id,
      '00000000-0000-4000-8000-000000000000',
    ];
    const bodies = new Set<string>();
    for (const id of ids) {
      const res = await postCancel(session, id);
      expect(res.status).toBe(404);
      bodies.add(JSON.stringify(res.body.error ?? res.body));
    }
    expect(bodies.size).toBe(1);

    const target = await providerAppointment(provider, patient.id, new Date(future.getTime() + 6 * 3600_000));
    const revoked = await createTestPatient(provider.id);
    await prisma.patient.update({ where: { id: revoked.id }, data: { portalAccessEnabled: false } });
    const unconsented = await createTestPatient(provider.id);
    for (const email of [ unique('nadie@test.local'), revoked.email!, unconsented.email! ]) {
      const res = await postCancel(sessionFor(provider.id, email), target.id);
      expect(res.status).toBe(404);
      bodies.add(JSON.stringify(res.body.error ?? res.body));
    }
    expect(bodies.size).toBe(1);

    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: target.id } })).status).toBe(AppointmentStatus.SCHEDULED);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: someoneElse.appointmentId } })).status).toBe(AppointmentStatus.CONFIRMED);
  });

  it('lets exactly one of two concurrent cancels through', async () => {
    const provider = await createLiveProvider();
    const { session, appointmentId } = await book(provider);

    const results = await Promise.all([ postCancel(session, appointmentId), postCancel(session, appointmentId) ]);

    expect(results.map((r) => r.status).sort()).toEqual([ 204, 404 ]);
    expect(await prisma.auditLog.count({
      where: { entityId: appointmentId, source: ActionSource.PUBLIC_PORTAL, actionType: 'UPDATE' },
    })).toBe(1);
  });

  it('queues the notices on the transaction and drops the queued reminder job when the scheduler is on', async () => {
    const provider = await createLiveProvider();
    const { session, appointmentId } = await book(provider);
    const reminder = await prisma.reminder.findUniqueOrThrow({ where: { appointmentId } });
    scheduler.enabled = true;
    mocks.dispatch.mockClear();

    expect((await postCancel(session, appointmentId)).status).toBe(204);

    expect(mocks.send.mock.calls).toEqual([
      [ 'portal-booking-notify', { appointmentId, kind: 'patient-cancellation' }, { db: expect.anything() } ],
      [ 'portal-booking-notify', { appointmentId, kind: 'provider-cancel-notice' }, { db: expect.anything() } ],
    ]);
    expect(mocks.findJobs).toHaveBeenCalledWith('send-reminder', { data: { reminderId: reminder.id }, queued: true });
    expect(mocks.cancel).toHaveBeenCalledWith('send-reminder', [ 'queued-job' ]);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('rolls back the status, reminder and audits when a later step fails', async () => {
    const provider = await createLiveProvider();
    const { session, appointmentId } = await book(provider);
    scheduler.enabled = true;
    mocks.send.mockRejectedValue(new Error('queue down'));

    expect((await postCancel(session, appointmentId)).status).toBe(500);

    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } })).status).toBe(AppointmentStatus.CONFIRMED);
    expect((await prisma.reminder.findUniqueOrThrow({ where: { appointmentId } })).status).toBe(ReminderStatus.PENDING);
    expect(await prisma.auditLog.count({
      where: { entityId: appointmentId, source: ActionSource.PUBLIC_PORTAL, actionType: 'UPDATE' },
    })).toBe(0);
  });

  it('keeps the cancellation when a notice fails after commit (scheduler off)', async () => {
    const provider = await createLiveProvider();
    const { session, appointmentId } = await book(provider);
    mocks.dispatch.mockResolvedValue({ success: false, error: 'Brevo down' });

    expect((await postCancel(session, appointmentId)).status).toBe(204);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } })).status).toBe(AppointmentStatus.CANCELLED);
  });

  it('requires the session, the CSRF header, the exact Origin, a uuid and an empty body', async () => {
    const provider = await createLiveProvider();
    const { session, appointmentId } = await book(provider);

    expect((await request(app).post(`/v1/portal/appointments/${appointmentId}/cancel`).set('Origin', ALLOWED_ORIGIN).send()).status).toBe(401);
    expect((await postCancel(session, appointmentId, { csrf: null })).status).toBe(403);
    expect((await postCancel(session, appointmentId, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await postCancel(session, 'not-a-uuid')).status).toBe(400);
    expect((await postCancel(session, appointmentId, { body: { reason: 'Me enfermé' } })).status).toBe(400);
    expect((await postCancel(session, appointmentId, { body: {} })).status).toBe(204);
  });

  it('computes the action flags per appointment', async () => {
    const provider = await createLiveProvider();
    const { session, appointmentId } = await book(provider);
    const flags = async () => {
      const [ a ] = (await listAppointments(session)).body.data.appointments;
      return { canCancel: a.canCancel, canReschedule: a.canReschedule };
    };

    expect(await flags()).toEqual({ canCancel: true, canReschedule: true });
    // A second bookable type keeps the provider live while the booked one stops being bookable.
    const spare = await createTestAppointmentType(provider.id);
    await prisma.appointmentType.update({ where: { id: spare.id }, data: { bookableOnline: true } });
    await prisma.appointmentType.update({ where: { id: provider.typeId }, data: { bookableOnline: false } });
    expect(await flags()).toEqual({ canCancel: true, canReschedule: false });
    await prisma.appointmentType.update({ where: { id: provider.typeId }, data: { bookableOnline: true } });
    await prisma.user.update({ where: { id: provider.id }, data: { bookingApprovalMode: BookingApprovalMode.REQUIRE_APPROVAL } });
    expect(await flags()).toEqual({ canCancel: true, canReschedule: false });
    expect((await postCancel(session, appointmentId)).status).toBe(204);
  });
});

describe('cancelling an appointment by any path cancels its pending reminder', () => {
  async function withReminder(provider: LiveProvider) {
    const patient = await createConsentedPatient(provider.id);
    const appt = await providerAppointment(provider, patient.id, new Date(Date.now() + 5 * 86_400_000));
    const reminder = await prisma.reminder.create({
      data: {
        userId: provider.id, patientId: patient.id, appointmentId: appt.id, channel: Channel.EMAIL, to: patient.email!,
        sendMode: 'SCHEDULED', sendAt: new Date(Date.now() + 4 * 86_400_000), status: ReminderStatus.PENDING, body: 'Recordatorio',
      },
    });
    return { appt, reminder };
  }

  it('on the provider cancel endpoint (setStatus)', async () => {
    const provider = await createLiveProvider();
    const { appt, reminder } = await withReminder(provider);

    const result = await appointmentService.setStatus(appt.id, provider.id, AppointmentStatus.CANCELLED);

    expect(result.reminder?.status).toBe(ReminderStatus.CANCELLED);
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).status).toBe(ReminderStatus.CANCELLED);
    expect(await prisma.auditLog.count({ where: { entityId: reminder.id, actionType: 'UPDATE' } })).toBe(1);
  });

  it('on an update that changes the status to CANCELLED', async () => {
    const provider = await createLiveProvider();
    const { appt, reminder } = await withReminder(provider);

    await appointmentService.update(appt.id, { status: AppointmentStatus.CANCELLED }, provider.id);

    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).status).toBe(ReminderStatus.CANCELLED);
  });

  it('but leaves already-sent reminders and other edits alone', async () => {
    const provider = await createLiveProvider();
    const { appt, reminder } = await withReminder(provider);
    await appointmentService.update(appt.id, { notes: 'Traer exámenes' }, provider.id);
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).status).toBe(ReminderStatus.PENDING);

    await prisma.reminder.update({ where: { id: reminder.id }, data: { status: ReminderStatus.SENT } });
    await appointmentService.setStatus(appt.id, provider.id, AppointmentStatus.CANCELLED);
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).status).toBe(ReminderStatus.SENT);
  });
});
