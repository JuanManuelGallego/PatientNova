import { fromPrisma } from 'pg-boss';
import { Channel } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { getBoss } from '../scheduler/pg-boss.js';
import { dispatchMessage, type DispatchOpts } from '../scheduler/dispatch.js';
import { renderBookingConfirmationEmail } from '../brevo/email-templates.js';
import { ACTIVE_STATUSES } from '../appointments/appointment-status.js';
import { formatDate, formatTime } from '../appointments/appointment-reminder.renderer.js';
import { providerDisplayName } from '../public-booking/public-booking.service.js';

const BOOKING_NOTIFICATION_KINDS = [ 'patient-confirmation', 'provider-notice' ] as const;
export type BookingNotificationKind = typeof BOOKING_NOTIFICATION_KINDS[number];

export interface BookingNotificationJob {
  appointmentId: string;
  kind: BookingNotificationKind;
}

const formatWhen = (at: Date, timezone: string) => `${formatDate(at, timezone, true)}, ${formatTime(at, timezone)}`;

async function loadAppointment(appointmentId: string) {
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      startAt: true,
      status: true,
      isDeleted: true,
      patientTimezone: true,
      patient: { select: { email: true } },
      appointmentLocation: { select: { name: true, address: true } },
      user: {
        select: {
          displayName: true, firstName: true, lastName: true, timezone: true, bookingSlug: true,
          reminderActive: true, reminderChannel: true, whatsappNumber: true, phoneNumber: true, email: true,
        },
      },
    },
  });
}

type BookedAppointment = NonNullable<Awaited<ReturnType<typeof loadAppointment>>>;

function patientConfirmation(appt: BookedAppointment): { channel: Channel; opts: DispatchOpts } | null {
  if (!appt.patient.email) return null;
  const timezone = appt.patientTimezone ?? appt.user.timezone;
  const path = appt.user.bookingSlug ? `/book/${appt.user.bookingSlug}/appointments` : '';
  const email = renderBookingConfirmationEmail({
    providerName: providerDisplayName(appt.user),
    whenLocal: formatWhen(appt.startAt, timezone),
    timezone,
    locationName: appt.appointmentLocation?.name ?? null,
    address: appt.appointmentLocation?.address ?? null,
    appointmentsUrl: `${config.portal.url}${path}`,
  });
  return { channel: Channel.EMAIL, opts: { to: appt.patient.email, subject: email.subject, body: email.body } };
}

function providerNotice(appt: BookedAppointment): { channel: Channel; opts: DispatchOpts } | null {
  const { user } = appt;
  if (!user.reminderActive) return null;
  const channel = user.reminderChannel;
  const to = channel === Channel.WHATSAPP ? user.whatsappNumber : channel === Channel.EMAIL ? user.email : user.phoneNumber;
  if (!to) return null;
  const name = providerDisplayName(user);
  if (channel === Channel.WHATSAPP) {
    const contentVariables = { '1': name, '2': formatDate(appt.startAt, user.timezone, true), '3': formatTime(appt.startAt, user.timezone) };
    return { channel, opts: { to, contentSid: config.twilio.portalBookingSid, contentVariables } };
  }
  const when = formatWhen(appt.startAt, user.timezone);
  const body = [
    `Hola, ${name}.`,
    '',
    `Tienes una nueva cita reservada en línea para el ${when}.`,
    '',
    `Revísala en PatientNova: ${config.portal.url}/calendar`,
  ].join('\n');
  return { channel, opts: { to, body, ...(channel === Channel.EMAIL && { subject: 'Nueva cita reservada en línea' }) } };
}

export async function deliverBookingNotification({ appointmentId, kind }: BookingNotificationJob): Promise<void> {
  const appt = await loadAppointment(appointmentId);
  if (!appt || appt.isDeleted || !ACTIVE_STATUSES.has(appt.status)) {
    logger.info({ appointmentId, kind }, 'Booking notification skipped — appointment no longer active');
    return;
  }
  const message = kind === 'patient-confirmation' ? patientConfirmation(appt) : providerNotice(appt);
  if (!message) {
    logger.info({ appointmentId, kind }, 'Booking notification skipped — disabled or no address');
    return;
  }
  const result = await dispatchMessage(message.channel, message.opts);
  if (!result.success) throw new Error(`Booking notification ${kind} failed: ${result.error ?? 'dispatch failed'}`);
  logger.info({ appointmentId, kind, channel: message.channel, messageId: result.messageSid }, 'Booking notification sent');
}

export async function enqueueBookingNotifications(appointmentId: string, tx: TransactionClient): Promise<void> {
  if (!config.scheduler.enabled) return;
  const db = fromPrisma(tx);
  for (const kind of BOOKING_NOTIFICATION_KINDS) {
    await getBoss().send('portal-booking-notify',{ appointmentId, kind } satisfies BookingNotificationJob, { db });
  }
}

export async function deliverBookingNotificationsNow(appointmentId: string): Promise<void> {
  if (config.scheduler.enabled) return;
  for (const kind of BOOKING_NOTIFICATION_KINDS) {
    try {
      await deliverBookingNotification({ appointmentId, kind });
    } catch (err) {
      logger.error({ appointmentId, kind, err }, 'Booking notification could not be sent');
    }
  }
}
