import { fromPrisma } from 'pg-boss';
import { BookingRequestStatus, Channel } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import type { PatientRoute } from '../portal/patient-route.js';
import { getBoss } from '../scheduler/pg-boss.js';
import { dispatchMessage, type DispatchOpts } from '../scheduler/dispatch.js';
import { formatDate, formatTime, formatWhen } from '../appointments/appointment-reminder.renderer.js';
import { providerDisplayName } from '../public-booking/public-booking.service.js';
import { bookingUrl } from '../booking-settings/booking-settings.service.js';
import { providerDestination } from '../portal/portal-booking-notifications.js';
import { renderPatientNotice } from '../portal/patient-notices.js';
import { requestContact } from '../portal/portal-contact.js';

export const BOOKING_REQUEST_NOTIFY_QUEUE = 'booking-request-notify';

/**
 * `received`/`nudge` go to the provider (no patient details); `rejected`/`expired` go to the patient. Approval is
 * confirmed through the appointment's own `portal-booking-notify` jobs.
 */
export type BookingRequestEvent = 'received' | 'nudge' | 'rejected' | 'expired' | 'unconfirmed-expired';

/** Job payload: ids only, never patient data. */
export interface BookingRequestNotificationJob {
  requestId: string;
  event: BookingRequestEvent;
}

const PROVIDER_EVENTS = new Set<BookingRequestEvent>([ 'received', 'nudge' ]);

async function loadRequest(requestId: string) {
  return prisma.bookingRequest.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      confirmedAt: true,
      confirmationSentAt: true,
      contactChannel: true,
      email: true,
      verifiedPhone: true,
      startAt: true,
      holdExpiresAt: true,
      patientTimezone: true,
      user: {
        select: {
          displayName: true, firstName: true, lastName: true, timezone: true, bookingSlug: true,
          reminderActive: true, reminderChannel: true, whatsappNumber: true, phoneNumber: true, email: true,
        },
      },
    },
  });
}

type LoadedRequest = NonNullable<Awaited<ReturnType<typeof loadRequest>>>;
type Message = { channel: Channel; opts: DispatchOpts };

/** Each event needs the state that caused it; a request resolved since then makes the job stale. */
function isDeliverable(request: LoadedRequest | null, event: BookingRequestEvent, now: Date): request is LoadedRequest {
  if (!request) return false;
  switch (event) {
    case 'received':
    case 'nudge':
      return request.status === BookingRequestStatus.PENDING && request.holdExpiresAt > now;
    case 'rejected':
      return request.status === BookingRequestStatus.REJECTED;
    case 'expired':
      return request.status === BookingRequestStatus.EXPIRED && request.confirmedAt !== null;
    case 'unconfirmed-expired':
      return request.status === BookingRequestStatus.EXPIRED && request.confirmedAt === null && request.confirmationSentAt !== null;
  }
}

const portalBase = (): string => config.portal.url.replace(/\/+$/, '');

function requestRoute(request: LoadedRequest): PatientRoute | null {
  const contact = requestContact(request);
  return contact && { channel: contact.channel, to: contact.value };
}

function noticeTimes(request: LoadedRequest) {
  return { providerName: providerDisplayName(request.user), at: request.startAt, timezone: request.patientTimezone };
}

function patientMessage(request: LoadedRequest, event: BookingRequestEvent): Message | null {
  const route = requestRoute(request);
  if (!route) return null;
  const params = { ...noticeTimes(request), bookingUrl: bookingUrl(request.user.bookingSlug) ?? portalBase() };
  const kinds = { rejected: 'request-rejected', expired: 'request-expired', 'unconfirmed-expired': 'unconfirmed-expired' } as const;
  const kind = kinds[event as keyof typeof kinds];
  return { channel: route.channel, opts: renderPatientNotice(kind, params, route) };
}

/** Provider notices carry no patient details. Formatted times end in "a. m."/"p. m.", so no full stop follows them. */
function providerMessage(request: LoadedRequest, event: BookingRequestEvent): Message | null {
  const { user } = request;
  const destination = providerDestination(user);
  if (!destination) return null;
  const { channel, to } = destination;
  const name = providerDisplayName(user);
  const tz = user.timezone;
  if (channel === Channel.WHATSAPP) {
    const slot = { '1': name, '2': formatDate(request.startAt, tz, true), '3': formatTime(request.startAt, tz) };
    // The nudge has its own template so it reads as a reminder, not as a second new request.
    const opts = event === 'nudge'
      ? { contentSid: config.twilio.portalRequestNudgeSid, contentVariables: { ...slot, '4': formatWhen(request.holdExpiresAt, tz) } }
      : { contentSid: config.twilio.portalRequestSid, contentVariables: slot };
    return { channel, opts: { to, ...opts } };
  }
  const when = formatWhen(request.startAt, tz);
  const lines = event === 'nudge'
    ? [
      `Una solicitud de cita en línea para el ${when} sigue pendiente de revisión.`,
      `Si no la revisas, el horario se liberará el ${formatWhen(request.holdExpiresAt, tz)}`,
    ]
    : [
      `Tienes una nueva solicitud de cita en línea para el ${when}`,
      'Confírmala o recházala antes de que venza.',
    ];
  const body = [
    `Hola, ${name}.`,
    '',
    ...lines,
    '',
    `Revísala en PatientNova: ${portalBase()}/requests`,
  ].join('\n');
  const subject = event === 'nudge' ? 'Solicitud de cita pendiente de revisión' : 'Nueva solicitud de cita en línea';
  return { channel, opts: { to, body, ...(channel === Channel.EMAIL && { subject }) } };
}

export async function deliverBookingRequestNotification(job: BookingRequestNotificationJob): Promise<void> {
  const { requestId, event } = job;
  const request = await loadRequest(requestId);
  if (!isDeliverable(request, event, new Date())) {
    logger.info({ requestId, event }, 'Booking request notification skipped — request no longer in the expected state');
    return;
  }
  if (event === 'unconfirmed-expired' && request.contactChannel !== Channel.EMAIL && !config.twilio.patientPortal.unconfirmedExpiredSid) {
    logger.info({ requestId, event }, 'Booking request notification skipped — WhatsApp template not configured');
    return;
  }
  const message = PROVIDER_EVENTS.has(event) ? providerMessage(request, event) : patientMessage(request, event);
  if (!message) {
    logger.info({ requestId, event }, 'Booking request notification skipped — disabled or no address');
    return;
  }
  const result = await dispatchMessage(message.channel, message.opts);
  if (!result.success) throw new Error(`Booking request notification ${event} failed: ${result.error ?? 'dispatch failed'}`);
  logger.info({ requestId, event, channel: message.channel, messageId: result.messageSid }, 'Booking request notification sent');
}

export async function sendRequestReceipt(requestId: string): Promise<void> {
  try {
    const request = await loadRequest(requestId);
    const route = request && requestRoute(request);
    if (!request || !route) return;
    const page = bookingUrl(request.user.bookingSlug);
    const opts = renderPatientNotice('request-received', {
      ...noticeTimes(request),
      appointmentsUrl: page ? `${page}/appointments` : portalBase(),
    }, route);
    const result = await dispatchMessage(route.channel, opts);
    if (!result.success) logger.error({ requestId, channel: route.channel }, 'Booking request receipt was not accepted');
  } catch (err) {
    logger.error({ requestId, errorName: err instanceof Error ? err.name : undefined }, 'Booking request receipt failed');
  }
}

/** Enqueued on the caller's `tx`, so a rollback drops them. No-op without the scheduler. */
export async function enqueueBookingRequestNotifications(
  event: BookingRequestEvent,
  requestIds: string[],
  tx: TransactionClient,
): Promise<void> {
  if (!config.scheduler.enabled || requestIds.length === 0) return;
  const db = fromPrisma(tx);
  for (const requestId of requestIds) {
    await getBoss().send(BOOKING_REQUEST_NOTIFY_QUEUE, { requestId, event } satisfies BookingRequestNotificationJob, { db });
  }
}

export interface ExpiredHolds {
  all: string[];
  expired: string[];
  unconfirmedExpired: string[];
}

export async function deliverExpiredHoldsNow(holds: ExpiredHolds): Promise<void> {
  await deliverBookingRequestNotificationsNow('expired', holds.expired);
  await deliverBookingRequestNotificationsNow('unconfirmed-expired', holds.unconfirmedExpired);
}

/** Without the scheduler: sent after commit, best effort (a failure never undoes the action that caused it). */
export async function deliverBookingRequestNotificationsNow(event: BookingRequestEvent, requestIds: string[]): Promise<void> {
  if (config.scheduler.enabled) return;
  for (const requestId of requestIds) {
    try {
      await deliverBookingRequestNotification({ requestId, event });
    } catch (err) {
      logger.error({ requestId, event, err }, 'Booking request notification could not be sent');
    }
  }
}
