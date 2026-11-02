import { fromPrisma } from 'pg-boss';
import { AppointmentStatus, Channel } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { getBoss } from '../scheduler/pg-boss.js';
import { dispatchMessage, type DispatchOpts } from '../scheduler/dispatch.js';
import {
  renderBookingConfirmationEmail,
  renderPortalCancellationEmail,
  renderPortalRescheduleEmail,
} from '../brevo/email-templates.js';
import { ACTIVE_STATUSES } from '../appointments/appointment-status.js';
import { formatDate, formatTime } from '../appointments/appointment-reminder.renderer.js';
import { providerDisplayName } from '../public-booking/public-booking.service.js';
import { bookingUrl } from '../booking-settings/booking-settings.service.js';

/** What the patient did in the portal; each event sends one patient email and one provider notice. */
export type PortalEvent = 'booked' | 'cancelled' | 'rescheduled';

const EVENT_KINDS = {
  booked: [ 'patient-confirmation', 'provider-notice' ],
  cancelled: [ 'patient-cancellation', 'provider-cancel-notice' ],
  rescheduled: [ 'patient-reschedule', 'provider-reschedule-notice' ],
} as const satisfies Record<PortalEvent, readonly [string, string]>;

export type BookingNotificationKind = typeof EVENT_KINDS[PortalEvent][number];

/** Job payload: ids and timestamps only, never patient data. Queue name `portal-booking-notify`. */
export interface BookingNotificationJob {
  appointmentId: string;
  kind: BookingNotificationKind;
  /** ISO start before a reschedule; only on the reschedule kinds. */
  previousStartAt?: string;
  /**
   * ISO start the reschedule moved to; only on the reschedule kinds. A later move supersedes the notice
   * (that move sends its own), so the patient never gets "before X, now Z" for a move to Y.
   */
  startAt?: string;
}

/** The start before and after a reschedule. */
export interface PortalMove {
  previousStartAt: Date;
  startAt: Date;
}

const CANCELLATION_KINDS = new Set<BookingNotificationKind>(EVENT_KINDS.cancelled);

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
type Message = { channel: Channel; opts: DispatchOpts };

/** A cancellation notice needs a cancelled appointment; every other notice needs an active one. */
function isDeliverable(appt: BookedAppointment | null, job: BookingNotificationJob): appt is BookedAppointment {
  if (!appt || appt.isDeleted) return false;
  if (job.startAt && appt.startAt.getTime() !== new Date(job.startAt).getTime()) return false;
  return CANCELLATION_KINDS.has(job.kind) ? appt.status === AppointmentStatus.CANCELLED : ACTIVE_STATUSES.has(appt.status);
}

function patientMessage(appt: BookedAppointment, job: BookingNotificationJob): Message | null {
  if (!appt.patient.email) return null;
  const timezone = appt.patientTimezone ?? appt.user.timezone;
  const bookPage = bookingUrl(appt.user.bookingSlug);
  const portalRoot = config.portal.url.replace(/\/+$/, '');
  const providerName = providerDisplayName(appt.user);
  const whenLocal = formatWhen(appt.startAt, timezone);
  const location = { locationName: appt.appointmentLocation?.name ?? null, address: appt.appointmentLocation?.address ?? null };
  const appointmentsUrl = bookPage ? `${bookPage}/appointments` : portalRoot;

  let email;
  if (job.kind === 'patient-cancellation') {
    email = renderPortalCancellationEmail({ providerName, whenLocal, timezone, bookingUrl: bookPage ?? portalRoot });
  } else if (job.kind === 'patient-reschedule') {
    if (!job.previousStartAt) return null;
    email = renderPortalRescheduleEmail({
      providerName, whenLocal, timezone, ...location, appointmentsUrl,
      previousLocal: formatWhen(new Date(job.previousStartAt), timezone),
    });
  } else {
    email = renderBookingConfirmationEmail({ providerName, whenLocal, timezone, ...location, appointmentsUrl });
  }
  return { channel: Channel.EMAIL, opts: { to: appt.patient.email, subject: email.subject, body: email.body } };
}

interface ProviderText {
  subject: string;
  /** Formatted times end in "a. m."/"p. m.", so they never come right before a full stop. */
  lines: string[];
  contentSid: string;
  contentVariables: Record<string, string>;
}

function providerText(appt: BookedAppointment, job: BookingNotificationJob, name: string): ProviderText | null {
  const tz = appt.user.timezone;
  const date = formatDate(appt.startAt, tz, true);
  const time = formatTime(appt.startAt, tz);
  const when = formatWhen(appt.startAt, tz);
  switch (job.kind) {
    case 'provider-cancel-notice':
      return {
        subject: 'Cita cancelada en línea',
        lines: [ `Un paciente canceló en línea su cita del ${when}; ese horario quedó libre en tu agenda.` ],
        contentSid: config.twilio.portalCancelSid,
        contentVariables: { '1': name, '2': date, '3': time },
      };
    case 'provider-reschedule-notice': {
      if (!job.previousStartAt) return null;
      const previous = formatWhen(new Date(job.previousStartAt), tz);
      return {
        subject: 'Cita reprogramada en línea',
        lines: [ 'Un paciente reprogramó en línea una cita.', `Antes: ${previous}`, `Ahora: ${when}` ],
        contentSid: config.twilio.portalRescheduleSid,
        contentVariables: { '1': name, '2': previous, '3': date, '4': time },
      };
    }
    default:
      return {
        subject: 'Nueva cita reservada en línea',
        lines: [ `Tienes una nueva cita reservada en línea: ${when}` ],
        contentSid: config.twilio.portalBookingSid,
        contentVariables: { '1': name, '2': date, '3': time },
      };
  }
}

/** Provider notices carry no patient details: only that something happened, and when. */
function providerMessage(appt: BookedAppointment, job: BookingNotificationJob): Message | null {
  const { user } = appt;
  if (!user.reminderActive) return null;
  const channel = user.reminderChannel;
  const to = channel === Channel.WHATSAPP ? user.whatsappNumber : channel === Channel.EMAIL ? user.email : user.phoneNumber;
  if (!to) return null;
  const name = providerDisplayName(user);
  const text = providerText(appt, job, name);
  if (!text) return null;
  if (channel === Channel.WHATSAPP) {
    return { channel, opts: { to, contentSid: text.contentSid, contentVariables: text.contentVariables } };
  }
  const body = [
    `Hola, ${name}.`,
    '',
    ...text.lines,
    '',
    `Revísala en PatientNova: ${config.portal.url}/calendar`,
  ].join('\n');
  return { channel, opts: { to, body, ...(channel === Channel.EMAIL && { subject: text.subject }) } };
}

export async function deliverBookingNotification(job: BookingNotificationJob): Promise<void> {
  const { appointmentId, kind } = job;
  const appt = await loadAppointment(appointmentId);
  if (!isDeliverable(appt, job)) {
    logger.info({ appointmentId, kind }, 'Portal notification skipped — appointment no longer in the expected state');
    return;
  }
  const message = kind.startsWith('patient-') ? patientMessage(appt, job) : providerMessage(appt, job);
  if (!message) {
    logger.info({ appointmentId, kind }, 'Portal notification skipped — disabled or no address');
    return;
  }
  const result = await dispatchMessage(message.channel, message.opts);
  if (!result.success) throw new Error(`Booking notification ${kind} failed: ${result.error ?? 'dispatch failed'}`);
  logger.info({ appointmentId, kind, channel: message.channel, messageId: result.messageSid }, 'Portal notification sent');
}

function jobsFor(event: PortalEvent, appointmentId: string, move?: PortalMove): BookingNotificationJob[] {
  return EVENT_KINDS[event].map((kind) => ({
    appointmentId,
    kind,
    ...(move && { previousStartAt: move.previousStartAt.toISOString(), startAt: move.startAt.toISOString() }),
  }));
}

/** Enqueued on the caller's `tx`, so a rollback drops them. No-op without the scheduler. */
export async function enqueuePortalNotifications(
  event: PortalEvent,
  appointmentId: string,
  tx: TransactionClient,
  move?: PortalMove,
): Promise<void> {
  if (!config.scheduler.enabled) return;
  const db = fromPrisma(tx);
  for (const job of jobsFor(event, appointmentId, move)) {
    await getBoss().send('portal-booking-notify', job, { db });
  }
}

/** Without the scheduler: sent after commit, best effort (a failure never undoes the patient's action). */
export async function deliverPortalNotificationsNow(event: PortalEvent, appointmentId: string, move?: PortalMove): Promise<void> {
  if (config.scheduler.enabled) return;
  for (const job of jobsFor(event, appointmentId, move)) {
    try {
      await deliverBookingNotification(job);
    } catch (err) {
      logger.error({ appointmentId, kind: job.kind, err }, 'Portal notification could not be sent');
    }
  }
}
