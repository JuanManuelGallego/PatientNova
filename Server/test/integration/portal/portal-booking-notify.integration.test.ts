import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { deliverBookingNotification } from '../../../src/portal/portal-booking-notifications.js';
import { portalBookingNotifyWorker } from '../../../src/scheduler/workers/portal-booking-notify.js';
import { AppointmentStatus, Channel, RecordSource } from '../../../generated/prisma/enums.js';
import { createTestLocation, createTestPatient, createTestUser } from '../helpers.js';

const MADRID = 'Europe/Madrid';

beforeEach(() => {
  mocks.dispatch.mockReset().mockResolvedValue({ success: true, messageSid: 'msg-1' });
});

async function bookedAppointment(opts: {
  startAt: string;
  patientTimezone?: string | null;
  provider?: Partial<{ reminderActive: boolean; reminderChannel: Channel; whatsappNumber: string; phoneNumber: string }>;
} ) {
  const user = await createTestUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { displayName: 'Dra. Ana Pública', bookingSlug: `dra-notify-${user.id.slice(-8)}`, timezone: 'America/Bogota', ...opts.provider },
  });
  const patient = await createTestPatient(user.id, { name: 'Lucia', lastName: 'Rojas' });
  const location = await createTestLocation(user.id, { name: 'Consultorio Centro' });
  await prisma.appointmentLocation.update({ where: { id: location.id }, data: { address: 'Calle 10 # 5-20' } });
  const startAt = new Date(opts.startAt);
  const appt = await prisma.appointment.create({
    data: {
      userId: user.id, patientId: patient.id, locationId: location.id, startAt,
      endAt: new Date(startAt.getTime() + 3600_000), price: 0, status: AppointmentStatus.CONFIRMED,
      source: RecordSource.PORTAL, patientTimezone: opts.patientTimezone === undefined ? MADRID : opts.patientTimezone,
    },
  });
  return { user: await prisma.user.findUniqueOrThrow({ where: { id: user.id } }), patient, appt };
}

describe('patient confirmation', () => {
  it('renders in the patient zone, following its DST rules rather than the provider\'s', async () => {
    const winter = await bookedAppointment({ startAt: '2027-01-20T15:00:00Z' });
    const summer = await bookedAppointment({ startAt: '2027-04-05T15:00:00Z' });

    await deliverBookingNotification({ appointmentId: winter.appt.id, kind: 'patient-confirmation' });
    await deliverBookingNotification({ appointmentId: summer.appt.id, kind: 'patient-confirmation' });

    const [ channel, w ] = mocks.dispatch.mock.calls[0]!;
    const [ , s ] = mocks.dispatch.mock.calls[1]!;
    expect(channel).toBe(Channel.EMAIL);
    expect(w.to).toBe(winter.patient.email);
    expect(w.subject).toBe('Cita confirmada con Dra. Ana Pública');
    expect(w.body).toContain('20 de enero de 2027, 04:00 p. m. (hora de Europe/Madrid)');
    expect(s.body).toContain('5 de abril de 2027, 05:00 p. m. (hora de Europe/Madrid)');
    expect(w.body).toContain('Lugar: Consultorio Centro');
    expect(w.body).toContain('Dirección: Calle 10 # 5-20');
    expect(w.body).toContain(`${config.portal.url}/book/${winter.user.bookingSlug}/appointments`);
  });

  it('falls back to the provider zone when no patient zone was stored', async () => {
    const { appt } = await bookedAppointment({ startAt: '2027-01-20T15:00:00Z', patientTimezone: null });
    await deliverBookingNotification({ appointmentId: appt.id, kind: 'patient-confirmation' });
    expect(mocks.dispatch.mock.calls[0]![1].body).toContain('10:00 a. m. (hora de America/Bogota)');
  });
});

describe('provider notice', () => {
  const START = '2027-01-20T15:00:00Z';

  it('goes out on WHATSAPP with the provider name, date and time in the provider zone', async () => {
    const { appt } = await bookedAppointment({
      startAt: START, provider: { reminderActive: true, reminderChannel: Channel.WHATSAPP, whatsappNumber: '+573001112233' },
    });

    await deliverBookingNotification({ appointmentId: appt.id, kind: 'provider-notice' });

    expect(mocks.dispatch).toHaveBeenCalledWith(Channel.WHATSAPP, {
      to: '+573001112233',
      contentSid: config.twilio.portalBookingSid,
      contentVariables: { '1': 'Dra. Ana Pública', '2': 'miércoles, 20 de enero de 2027', '3': '10:00 a. m.' },
    });
  });

  it('goes out on SMS in the provider zone without patient details', async () => {
    const { appt } = await bookedAppointment({
      startAt: START, provider: { reminderActive: true, reminderChannel: Channel.SMS, phoneNumber: '+573004445566' },
    });

    await deliverBookingNotification({ appointmentId: appt.id, kind: 'provider-notice' });

    const [ channel, opts ] = mocks.dispatch.mock.calls[0]!;
    expect(channel).toBe(Channel.SMS);
    expect(opts.to).toBe('+573004445566');
    expect(opts.body).toContain('Hola, Dra. Ana Pública.');
    expect(opts.body).toContain('20 de enero de 2027, 10:00 a. m.');
    expect(opts.body).not.toMatch(/Lucia|Rojas|Madrid/);
  });

  it('goes to the provider email with a subject on EMAIL', async () => {
    const { appt, user } = await bookedAppointment({ startAt: START, provider: { reminderActive: true, reminderChannel: Channel.EMAIL } });

    await deliverBookingNotification({ appointmentId: appt.id, kind: 'provider-notice' });

    expect(mocks.dispatch).toHaveBeenCalledWith(Channel.EMAIL, expect.objectContaining({
      to: user.email,
      subject: 'Nueva cita reservada en línea',
      body: expect.stringContaining(`${config.portal.url}/calendar`),
    }));
  });

  it('is skipped when the provider turned notices off or has no contact for the channel', async () => {
    const off = await bookedAppointment({ startAt: START, provider: { reminderActive: false } });
    const noNumber = await bookedAppointment({ startAt: START, provider: { reminderActive: true, reminderChannel: Channel.WHATSAPP } });
    await deliverBookingNotification({ appointmentId: off.appt.id, kind: 'provider-notice' });
    await deliverBookingNotification({ appointmentId: noNumber.appt.id, kind: 'provider-notice' });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});

describe('delivery rules', () => {
  it('skips cancelled and deleted appointments', async () => {
    const cancelled = await bookedAppointment({ startAt: '2027-01-20T15:00:00Z' });
    await prisma.appointment.update({ where: { id: cancelled.appt.id }, data: { status: AppointmentStatus.CANCELLED } });
    const deleted = await bookedAppointment({ startAt: '2027-01-20T15:00:00Z' });
    await prisma.appointment.update({ where: { id: deleted.appt.id }, data: { isDeleted: true, deletedAt: new Date() } });

    await deliverBookingNotification({ appointmentId: cancelled.appt.id, kind: 'patient-confirmation' });
    await deliverBookingNotification({ appointmentId: deleted.appt.id, kind: 'patient-confirmation' });

    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('throws on a failed send so the worker retries', async () => {
    const { appt } = await bookedAppointment({ startAt: '2027-01-20T15:00:00Z' });
    mocks.dispatch.mockResolvedValue({ success: false, error: 'Brevo down' });

    await expect(portalBookingNotifyWorker([ { data: { appointmentId: appt.id, kind: 'patient-confirmation' } } ]))
      .rejects.toThrow('Booking notification patient-confirmation failed: Brevo down');
  });
});
