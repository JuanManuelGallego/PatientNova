import { ActionType, BookingRequestKind, BookingRequestStatus, EntityType } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { ONE_MINUTE_MS } from '../utils/config/constants.js';
import { logger } from '../utils/api/logger.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { portalPatientAuditContext } from '../audit-log/audit-actors.js';
import { bookingRequestRepository } from '../booking-requests/booking-request.repository.js';
import {
  holdExpiry,
  MAX_PENDING_REQUESTS_PER_CONTACT,
  MAX_PENDING_REQUESTS_PER_PROVIDER,
} from '../booking-requests/booking-request.constants.js';
import {
  deliverBookingRequestNotificationsNow,
  enqueueBookingRequestNotifications,
} from '../booking-requests/booking-request-notifications.js';
import { hashRequestToken } from '../booking-requests/request-token.js';
import {
  ProviderNotFoundError,
  PublicAppointmentTypeNotFoundError,
  PublicLocationNotFoundError,
} from '../public-booking/public-booking.errors.js';
import type { ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { isSlotFree, type SlotSettings } from '../public-booking/public-booking.service.js';
import { bookingSettingsService } from '../booking-settings/booking-settings.service.js';
import { ownRequestWhere, requestContact, type PortalContact } from './portal-contact.js';
import { bookForIdentityWithin, requireBookableTarget, resolveBookingMode, toPortalError } from './portal-booking.service.js';
import { deliverPortalNotificationsNow, type PortalEvent } from './portal-booking-notifications.js';
import {
  PortalBookingLimitError,
  PortalBookingUnavailableError,
  PortalRequestCapacityError,
  PortalRequestLimitError,
  SlotUnavailableError,
} from './portal-booking.errors.js';
import { toBookingConfirmationView, type BookingConfirmationView } from './booking-confirmation.dto.js';
import { BookingConfirmationNotFoundError } from './booking-confirmation.errors.js';

type ConfirmRow = NonNullable<Awaited<ReturnType<typeof bookingRequestRepository.findByConfirmTokenHash>>>;

type Confirmed =
  | { kind: 'none' }
  | { kind: 'request'; requestId: string }
  | { kind: 'appointment'; appointmentId: string; event: PortalEvent };

const REFUSALS = [
  PortalBookingUnavailableError,
  PortalBookingLimitError,
  PortalRequestCapacityError,
  PortalRequestLimitError,
  ProviderNotFoundError,
  PublicAppointmentTypeNotFoundError,
  PublicLocationNotFoundError,
  SlotUnavailableError,
];

const isRefusal = (err: unknown): boolean => REFUSALS.some((type) => err instanceof type);

async function loadView(hash: string): Promise<BookingConfirmationView> {
  const row = await bookingRequestRepository.findConfirmationView(hash);
  if (!row || !(await bookingSettingsService.isPortalReachable(row.userId))) throw new BookingConfirmationNotFoundError();
  return toBookingConfirmationView(row, new Date());
}

async function isHeldSlotFree(tx: TransactionClient, row: ConfirmRow, settings: SlotSettings, now: Date): Promise<boolean> {
  const elapsedMinutes = Math.ceil((now.getTime() - row.createdAt.getTime()) / ONE_MINUTE_MS);
  const asHeld = { ...settings, minLeadMinutes: Math.max(0, settings.minLeadMinutes - elapsedMinutes) };
  const durationMinutes = Math.round((row.endAt.getTime() - row.startAt.getTime()) / ONE_MINUTE_MS);
  return isSlotFree(row.userId, asHeld, durationMinutes, row.startAt, now, { tx, excludeRequestId: row.id });
}

function proven(row: ConfirmRow): PortalContact {
  const contact = requestContact(row);
  if (!contact) throw new Error('Booking request has no contact');
  return contact;
}

async function enterInboxWithin(tx: TransactionClient, row: ConfirmRow, kind: BookingRequestKind, now: Date): Promise<Confirmed> {
  const own = ownRequestWhere(proven(row));
  if (!own || await bookingRequestRepository.countLiveConfirmed(row.userId, now, tx, own) >= MAX_PENDING_REQUESTS_PER_CONTACT) {
    throw new PortalRequestLimitError();
  }
  if (await bookingRequestRepository.countLivePending(row.userId, now, tx) >= MAX_PENDING_REQUESTS_PER_PROVIDER) {
    throw new PortalRequestCapacityError();
  }
  const holdExpiresAt = holdExpiry(now, row.startAt);
  await bookingRequestRepository.markConfirmedPending(row.id, { kind, confirmedAt: now, holdExpiresAt }, tx);
  await logAudit({
    entityType: EntityType.BOOKING_REQUEST,
    entityId: row.id,
    userId: row.userId,
    actionType: ActionType.UPDATE,
    description: 'Solicitud de reserva confirmada por el paciente',
    affectedFields: [ 'status', 'kind', 'confirmedAt', 'holdExpiresAt' ],
    fieldsBefore: { status: BookingRequestStatus.UNCONFIRMED },
    fieldsAfter: { status: BookingRequestStatus.PENDING, kind, confirmedAt: now, holdExpiresAt },
    tx,
    required: true,
  });
  await enqueueBookingRequestNotifications('received', [ row.id ], tx);
  return { kind: 'request', requestId: row.id };
}

async function confirmWithin(tx: TransactionClient, hash: string, userId: string): Promise<Confirmed> {
  await withProviderLock(tx, userId);
  const now = new Date();
  const row = await bookingRequestRepository.findByConfirmTokenHash(hash, tx);
  if (!row || row.status !== BookingRequestStatus.UNCONFIRMED || row.holdExpiresAt <= now) return { kind: 'none' };

  const { settings, approval } = await resolveBookingMode(userId, tx);
  const { type, location } = await requireBookableTarget(userId, row, tx);
  if (!(await isHeldSlotFree(tx, row, settings, now))) throw new SlotUnavailableError();
  if (approval) return enterInboxWithin(tx, row, BookingRequestKind.NEW, now);

  const booked = await bookForIdentityWithin(tx, { userId, contact: proven(row) }, {
    patient: { name: row.name, lastName: row.lastName, phone: row.phone },
    type,
    location,
    start: row.startAt,
    end: row.endAt,
    patientTimezone: row.patientTimezone,
    reminderTiming: settings.portalReminderTiming,
    consent: {
      policyVersion: row.policyVersion,
      acceptedAt: row.consentAcceptedAt,
      meta: { ipAddress: row.consentIp ?? undefined, userAgent: row.consentUserAgent ?? undefined },
    },
    excludeRequestId: row.id,
  }, now);
  if (booked.kind === 'review') return enterInboxWithin(tx, row, BookingRequestKind.REVIEW, now);

  const { appointmentId, patientId } = booked;
  await bookingRequestRepository.resolve(row.id, {
    status: BookingRequestStatus.APPROVED,
    resolvedAt: now,
    resolvedBy: 'patient',
    confirmedAt: now,
    appointmentId,
    patientId,
  }, tx);
  await logAudit({
    entityType: EntityType.BOOKING_REQUEST,
    entityId: row.id,
    userId,
    actionType: ActionType.UPDATE,
    description: 'Reserva confirmada por el paciente',
    affectedFields: [ 'status', 'confirmedAt', 'appointmentId', 'patientId' ],
    fieldsBefore: { status: BookingRequestStatus.UNCONFIRMED },
    fieldsAfter: { status: BookingRequestStatus.APPROVED, confirmedAt: now, appointmentId, patientId },
    tx,
    required: true,
  });
  return { kind: 'appointment', appointmentId, event: booked.event };
}

async function releaseRefused(hash: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await withProviderLock(tx, userId);
    const row = await bookingRequestRepository.findByConfirmTokenHash(hash, tx);
    if (!row || row.status !== BookingRequestStatus.UNCONFIRMED) return;
    await bookingRequestRepository.cancel(row.id, new Date(), tx, 'system');
    await logAudit({
      entityType: EntityType.BOOKING_REQUEST,
      entityId: row.id,
      userId,
      actionType: ActionType.UPDATE,
      description: 'Reserva sin confirmar liberada: la reserva no se pudo confirmar',
      affectedFields: [ 'status' ],
      fieldsBefore: { status: BookingRequestStatus.UNCONFIRMED },
      fieldsAfter: { status: BookingRequestStatus.CANCELLED },
      tx,
      required: true,
    });
  }, { timeout: 10000 });
}

async function afterCommit(outcome: Confirmed): Promise<void> {
  if (outcome.kind === 'appointment') await deliverPortalNotificationsNow(outcome.event, outcome.appointmentId);
  if (outcome.kind === 'request') await deliverBookingRequestNotificationsNow('received', [ outcome.requestId ]);
}

export const bookingConfirmationService = {
  async view(token: string): Promise<BookingConfirmationView> {
    return loadView(hashRequestToken(token));
  },

  async confirm(token: string, meta: ConsentRequestMeta): Promise<BookingConfirmationView> {
    const hash = hashRequestToken(token);
    const found = await bookingRequestRepository.findByConfirmTokenHash(hash);
    if (!found) throw new BookingConfirmationNotFoundError();
    const { id: requestId, userId } = found;
    const auditContext = portalPatientAuditContext({ userId, contact: proven(found), ipAddress: meta.ipAddress });

    let outcome: Confirmed;
    try {
      outcome = await runInAuditContext(auditContext, () =>
        prisma.$transaction((tx) => confirmWithin(tx, hash, userId), { timeout: 10000 }),
      );
    } catch (err) {
      const mapped = toPortalError(err);
      if (!isRefusal(mapped)) throw mapped;
      try {
        await runInAuditContext(auditContext, () => releaseRefused(hash, userId));
      } catch (releaseErr) {
        logger.error({ requestId, errorName: releaseErr instanceof Error ? releaseErr.name : undefined }, 'Refused booking hold was not released');
      }
      logger.info({ requestId, userId, reason: (mapped as Error).constructor.name }, 'Booking confirmation refused');
      throw mapped;
    }

    await afterCommit(outcome);
    if (outcome.kind !== 'none') logger.info({ requestId, userId, outcome: outcome.kind }, 'Booking confirmed by the patient');
    return loadView(hash);
  },
};
