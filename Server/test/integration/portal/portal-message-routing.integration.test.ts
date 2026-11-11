import type express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), send: vi.fn() }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: () => ({ send: mocks.send }) }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { Channel, PatientStatus, PortalReminderTiming, RecordSource, ReminderStatus } from '../../../generated/prisma/enums.js';
import { deliverBookingNotification, type BookingNotificationKind } from '../../../src/portal/portal-booking-notifications.js';
import { deliverBookingRequestNotification } from '../../../src/booking-requests/booking-request-notifications.js';
import { createPortalAppointmentWithin } from '../../../src/portal/portal-booking.service.js';
import { patientService } from '../../../src/patients/patient.service.js';
import { unique } from '../helpers.js';
import {
  buildPortalApp, createConsentedPatient, createLiveProvider, portalBookingBody, portalPost, sessionFor, slotStarts,
  type LiveProvider,
} from './portal-helpers.js';

const WHATSAPP_NUMBER = '+573001112233';
const SMS_NUMBER = '+573004445566';

const portal = config.portal as { patientEnabled: boolean };
const scheduler = config.scheduler as { enabled: boolean };
const was = { portal: portal.patientEnabled, scheduler: scheduler.enabled };
beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = was.portal; scheduler.enabled = was.scheduler; });

let app: express.Express;
beforeEach(() => {
  app = buildPortalApp();
  scheduler.enabled = false;
  mocks.dispatch.mockReset().mockResolvedValue({ success: true, messageSid: 'msg-1' });
  mocks.send.mockReset().mockResolvedValue('job-1');
});

type Contact = Partial<{
  email: string | null;
  whatsappNumber: string | null;
  smsNumber: string | null;
  whatsappUnverified: boolean;
  reminderChannel: Channel;
}>;

async function patientWith(userId: string, contact: Contact, source: RecordSource = RecordSource.PROVIDER) {
  return prisma.patient.create({
    data: { name: 'Lucia', lastName: 'Rojas', status: PatientStatus.ACTIVE, userId, source, reminderChannel: Channel.EMAIL, ...contact },
  });
}

async function appointmentFor(provider: LiveProvider, patientId: string, daysAhead = 5) {
  const startAt = new Date(Date.now() + daysAhead * 86_400_000);
  return prisma.appointment.create({
    data: {
      userId: provider.id, patientId, locationId: provider.locationId, typeId: provider.typeId,
      startAt, endAt: new Date(startAt.getTime() + 3_600_000), price: 0,
      status: 'CONFIRMED', source: RecordSource.PORTAL, patientTimezone: 'America/Bogota',
    },
  });
}

const PATIENT_KINDS: { kind: BookingNotificationKind; prepare?: (id: string) => Promise<unknown>; job?: object; sid: string }[] = [
  { kind: 'patient-confirmation', sid: config.twilio.patientPortal.confirmationSid },
  {
    kind: 'patient-cancellation',
    prepare: (id) => prisma.appointment.update({ where: { id }, data: { status: 'CANCELLED' } }),
    sid: config.twilio.patientPortal.cancelSid,
  },
  { kind: 'patient-reschedule', job: { previousStartAt: new Date(Date.now() + 86_400_000).toISOString() }, sid: config.twilio.patientPortal.rescheduleSid },
  {
    kind: 'patient-meeting-link',
    prepare: (id) => prisma.appointment.update({ where: { id }, data: { meetingUrl: 'https://meet.google.com/abc', meetingStatus: 'READY' } }),
    sid: config.twilio.appointmentMeetingLinkSid,
  },
];

describe('patient notices', () => {
  describe.each(PATIENT_KINDS)('$kind', ({ kind, prepare, job, sid }) => {
    async function deliverTo(contact: Contact) {
      const provider = await createLiveProvider();
      const patient = await patientWith(provider.id, contact);
      const appt = await appointmentFor(provider, patient.id);
      await prepare?.(appt.id);
      await deliverBookingNotification({ appointmentId: appt.id, kind, ...job });
      expect(mocks.dispatch).toHaveBeenCalledTimes(1);
      return mocks.dispatch.mock.calls[0]! as [ Channel, Record<string, unknown> ];
    }

    it('goes by WhatsApp to a WhatsApp patient', async () => {
      const [ channel, opts ] = await deliverTo({ email: unique('a@test.local'), whatsappNumber: WHATSAPP_NUMBER, reminderChannel: Channel.WHATSAPP });
      expect(channel).toBe(Channel.WHATSAPP);
      expect(opts).toMatchObject({ to: WHATSAPP_NUMBER, contentSid: sid });
    });

    it('goes by SMS to an SMS patient', async () => {
      const [ channel, opts ] = await deliverTo({ email: unique('a@test.local'), smsNumber: SMS_NUMBER, reminderChannel: Channel.SMS });
      expect(channel).toBe(Channel.SMS);
      expect(opts.to).toBe(SMS_NUMBER);
      expect(opts.body).toEqual(expect.any(String));
      expect(opts.contentSid).toBeUndefined();
    });

    it('goes by email to an email patient', async () => {
      const email = unique('a@test.local');
      const [ channel, opts ] = await deliverTo({ email, whatsappNumber: WHATSAPP_NUMBER, reminderChannel: Channel.EMAIL });
      expect(channel).toBe(Channel.EMAIL);
      expect(opts.to).toBe(email);
      expect(opts.subject).toEqual(expect.any(String));
    });
  });

  it('honors a number changed after the job was queued, since the worker reads the contact when it delivers', async () => {
    const provider = await createLiveProvider();
    const patient = await patientWith(provider.id, { whatsappNumber: WHATSAPP_NUMBER, reminderChannel: Channel.WHATSAPP });
    const appt = await appointmentFor(provider, patient.id);
    await prisma.patient.update({ where: { id: patient.id }, data: { whatsappNumber: '+573009998877' } });
    await deliverBookingNotification({ appointmentId: appt.id, kind: 'patient-confirmation' });
    expect(mocks.dispatch.mock.calls[0]![1].to).toBe('+573009998877');
  });

  it('never messages an unverified number: it falls back to email, or skips with no other address', async () => {
    const provider = await createLiveProvider();
    const email = unique('a@test.local');
    const withEmail = await patientWith(provider.id, {
      email, whatsappNumber: WHATSAPP_NUMBER, whatsappUnverified: true, reminderChannel: Channel.WHATSAPP,
    });
    await deliverBookingNotification({ appointmentId: (await appointmentFor(provider, withEmail.id)).id, kind: 'patient-confirmation' });
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch.mock.calls[0]![0]).toBe(Channel.EMAIL);
    expect(mocks.dispatch.mock.calls[0]![1].to).toBe(email);

    mocks.dispatch.mockClear();
    const withoutEmail = await patientWith(provider.id, { whatsappNumber: '+573001110000', whatsappUnverified: true, reminderChannel: Channel.WHATSAPP });
    await deliverBookingNotification({ appointmentId: (await appointmentFor(provider, withoutEmail.id, 6)).id, kind: 'patient-confirmation' });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('throws on a failed send so the worker retries', async () => {
    const provider = await createLiveProvider();
    const patient = await patientWith(provider.id, { whatsappNumber: WHATSAPP_NUMBER, reminderChannel: Channel.WHATSAPP });
    const appt = await appointmentFor(provider, patient.id);
    mocks.dispatch.mockResolvedValueOnce({ success: false, error: 'rejected by carrier' });
    await expect(deliverBookingNotification({ appointmentId: appt.id, kind: 'patient-confirmation' }))
      .rejects.toThrow('patient-confirmation failed');
  });
});

describe('reminders of portal bookings', () => {
  async function bookAs(provider: LiveProvider, email: string, overrides: Record<string, unknown> = {}) {
    const [ start ] = await slotStarts(provider);
    const res = await portalPost(app, '/v1/portal/bookings', sessionFor(provider.id, email), portalBookingBody(provider, start!, overrides));
    expect(res.status).toBe(201);
    return prisma.appointment.findUniqueOrThrow({ where: { id: res.body.data.appointment.id }, include: { reminder: true, patient: true } });
  }

  it('an existing WhatsApp patient logging in by email gets the reminder on WhatsApp', async () => {
    const provider = await createLiveProvider();
    const patient = await createConsentedPatient(provider.id);
    await prisma.patient.update({ where: { id: patient.id }, data: { whatsappNumber: WHATSAPP_NUMBER, reminderChannel: Channel.WHATSAPP } });

    const appt = await bookAs(provider, patient.email!);

    expect(appt.reminder).toMatchObject({ channel: Channel.WHATSAPP, to: WHATSAPP_NUMBER, status: ReminderStatus.PENDING });
  });

  it('a new patient stays on email and the typed number is flagged', async () => {
    const provider = await createLiveProvider();
    const email = unique('nuevo@test.local');

    const appt = await bookAs(provider, email);

    expect(appt.reminder).toMatchObject({ channel: Channel.EMAIL, to: email });
    expect(appt.patient).toMatchObject({ whatsappNumber: '+573001112233', whatsappUnverified: true, reminderChannel: Channel.EMAIL });
  });

  it('a new patient with no typed number is not flagged', async () => {
    const provider = await createLiveProvider();
    const appt = await bookAs(provider, unique('nuevo@test.local'), { patient: { name: 'Lucia', lastName: 'Rojas' } });
    expect(appt.patient).toMatchObject({ whatsappNumber: null, whatsappUnverified: false });
  });

  it('a patient with no usable route still gets the appointment, without a reminder', async () => {
    const provider = await createLiveProvider();
    const patient = await patientWith(provider.id, { whatsappNumber: WHATSAPP_NUMBER, whatsappUnverified: true });
    const [ start ] = await slotStarts(provider);
    const startAt = new Date(start!);

    const { appointment } = await prisma.$transaction((tx) => createPortalAppointmentWithin(tx, {
      userId: provider.id,
      patientId: patient.id,
      typeId: provider.typeId,
      locationId: provider.locationId,
      isVirtual: false,
      price: 0,
      start: startAt,
      end: new Date(startAt.getTime() + 3_600_000),
      patientTimezone: 'America/Bogota',
      reminderTiming: PortalReminderTiming.ONE_DAY_BEFORE,
    }, new Date()));

    const created = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id }, include: { reminder: true } });
    expect(created.reminder).toBeNull();
  });

  it('a settled reminder is replaced on the patient route, not always by email', async () => {
    const provider = await createLiveProvider();
    const patient = await createConsentedPatient(provider.id);
    const session = sessionFor(provider.id, patient.email!);
    await prisma.patient.update({ where: { id: patient.id }, data: { smsNumber: SMS_NUMBER, reminderChannel: Channel.SMS } });
    const [ first, second ] = await slotStarts(provider);
    const booked = await portalPost(app, '/v1/portal/bookings', session, portalBookingBody(provider, first!));
    const appointmentId = booked.body.data.appointment.id as string;
    await prisma.reminder.updateMany({ where: { patientId: patient.id }, data: { status: ReminderStatus.SENT } });

    const moved = await portalPost(app, `/v1/portal/appointments/${appointmentId}/reschedule`, session, {
      startUtc: second, patientTimezone: 'America/Bogota',
    });

    expect(moved.status).toBe(200);
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include: { reminder: true } });
    expect(appt.reminder).toMatchObject({ channel: Channel.SMS, to: SMS_NUMBER, status: ReminderStatus.PENDING });
  });

  it('a pending reminder keeps its channel and address when the appointment moves', async () => {
    const provider = await createLiveProvider();
    const patient = await createConsentedPatient(provider.id);
    const session = sessionFor(provider.id, patient.email!);
    const [ first, second ] = await slotStarts(provider);
    const booked = await portalPost(app, '/v1/portal/bookings', session, portalBookingBody(provider, first!));
    const appointmentId = booked.body.data.appointment.id as string;
    await prisma.patient.update({ where: { id: patient.id }, data: { smsNumber: SMS_NUMBER, reminderChannel: Channel.SMS } });

    await portalPost(app, `/v1/portal/appointments/${appointmentId}/reschedule`, session, { startUtc: second, patientTimezone: 'America/Bogota' });

    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include: { reminder: true } });
    expect(appt.reminder).toMatchObject({ channel: Channel.EMAIL, to: patient.email });
  });
});

describe('notices of requests', () => {
  async function requestIn(status: 'REJECTED' | 'EXPIRED') {
    const provider = await createLiveProvider();
    const email = unique('solicitud@test.local');
    const [ start ] = await slotStarts(provider);
    const startAt = new Date(start!);
    const request = await prisma.bookingRequest.create({
      data: {
        userId: provider.id, email, name: 'Lucia', lastName: 'Rojas', phone: WHATSAPP_NUMBER, status,
        typeId: provider.typeId, locationId: provider.locationId, startAt, endAt: new Date(startAt.getTime() + 3_600_000),
        patientTimezone: 'America/Bogota', holdExpiresAt: new Date(Date.now() + 3_600_000),
        policyVersion: 'v1', consentAcceptedAt: new Date(),
      },
    });
    return { request, email };
  }

  it.each([
    [ 'REJECTED', 'rejected' ],
    [ 'EXPIRED', 'expired' ],
  ] as const)('a %s request goes to its contact, never to the typed number', async (status, event) => {
    const { request, email } = await requestIn(status);
    await deliverBookingRequestNotification({ requestId: request.id, event });
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch.mock.calls[0]![0]).toBe(Channel.EMAIL);
    expect(mocks.dispatch.mock.calls[0]![1].to).toBe(email);
  });
});

describe('endorsing an unverified number', () => {
  async function flagged(overrides: Contact = {}) {
    const provider = await createLiveProvider();
    const patient = await patientWith(provider.id, {
      email: unique('a@test.local'), whatsappNumber: WHATSAPP_NUMBER, whatsappUnverified: true, ...overrides,
    }, RecordSource.PORTAL);
    return { provider, patient };
  }

  it('clears when the provider changes the number', async () => {
    const { provider, patient } = await flagged();
    const updated = await patientService.update(patient.id, { whatsappNumber: '+573009998877' }, provider.id);
    expect(updated.whatsappUnverified).toBe(false);
  });

  it('clears when the provider sets WhatsApp as the channel', async () => {
    const { provider, patient } = await flagged();
    const updated = await patientService.update(patient.id, { reminderChannel: Channel.WHATSAPP }, provider.id);
    expect(updated.whatsappUnverified).toBe(false);
  });

  it('stays when the provider saves the form with the same number and another channel', async () => {
    const { provider, patient } = await flagged();
    const updated = await patientService.update(
      patient.id,
      { name: 'Lucía', whatsappNumber: WHATSAPP_NUMBER, reminderChannel: Channel.EMAIL },
      provider.id,
    );
    expect(updated.whatsappUnverified).toBe(true);
  });

  it('records the change in the patient audit', async () => {
    const { provider, patient } = await flagged();
    await patientService.update(patient.id, { reminderChannel: Channel.WHATSAPP }, provider.id);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: patient.id, actionType: 'UPDATE' } });
    expect(audit.affectedFields).toContain('whatsappUnverified');
  });
});
