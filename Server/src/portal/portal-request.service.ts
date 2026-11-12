import { ActionType, BookingRequestKind, BookingRequestStatus, EntityType } from '../../generated/prisma/enums.js';
import {
  deliverBookingRequestNotificationsNow,
  deliverExpiredHoldsNow,
  sendRequestReceipt,
  type ExpiredHolds,
} from '../booking-requests/booking-request-notifications.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { ONE_MINUTE_MS } from '../utils/config/constants.js';
import { logger } from '../utils/api/logger.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { portalPatientAuditContext } from '../audit-log/audit-actors.js';
import { bookingRequestRepository } from '../booking-requests/booking-request.repository.js';
import { bookingRequestService } from '../booking-requests/booking-request.service.js';
import {
  MAX_PENDING_REQUESTS_PER_CONTACT,
  MAX_PENDING_REQUESTS_PER_PROVIDER,
} from '../booking-requests/booking-request.constants.js';
import type { ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { PRIVACY_POLICY_VERSION } from './privacy-policy.js';
import { isPhoneContact, ownRequestWhere } from './portal-contact.js';
import {
  PortalPatientDetailsRequiredError,
  PortalRequestCapacityError,
  PortalRequestLimitError,
  PortalRequestNotFoundError,
} from './portal-booking.errors.js';
import { toPortalRequestDto, type PortalRequestDto } from './portal-request.dto.js';
import type { CreatePortalBookingBody } from './portal-booking.schemas.js';
import type { PortalSessionContext } from './portal-session.middleware.js';

export interface HeldSlot {
  request: PortalRequestDto;
  /** Stale holds expired on the way; delivered after commit by `afterRequestCreated`. */
  expiredIds: ExpiredHolds;
}

/** The caller holds the provider lock and has already checked `isSlotFree` (holds counted) on this `tx`. */
export async function holdSlotWithin(
  tx: TransactionClient,
  session: PortalSessionContext,
  body: CreatePortalBookingBody,
  meta: ConsentRequestMeta,
  slot: { typeId: string; locationId: string; durationMinutes: number; start: Date },
  now: Date,
  kind: BookingRequestKind = BookingRequestKind.NEW,
): Promise<HeldSlot> {
  const { userId } = session;
  if (!body.patient) throw new PortalPatientDetailsRequiredError();
  const end = new Date(slot.start.getTime() + slot.durationMinutes * ONE_MINUTE_MS);

  const { contact } = session;
  const own = ownRequestWhere(contact);
  if (!own) throw new PortalRequestLimitError();
  const [ forContact, forProvider ] = await Promise.all([
    bookingRequestRepository.countLive(userId, now, tx, own),
    bookingRequestRepository.countLive(userId, now, tx),
  ]);
  if (forContact >= MAX_PENDING_REQUESTS_PER_CONTACT) throw new PortalRequestLimitError();
  if (forProvider >= MAX_PENDING_REQUESTS_PER_PROVIDER) throw new PortalRequestCapacityError();

  const { request, expiredIds } = await bookingRequestService.createHoldWithin(tx, userId, {
    kind,
    contactChannel: contact.channel,
    email: isPhoneContact(contact) ? null : contact.value,
    verifiedPhone: isPhoneContact(contact) ? contact.value : null,
    name: body.patient.name,
    lastName: body.patient.lastName,
    phone: body.patient.phone || null,
    typeId: slot.typeId,
    locationId: slot.locationId,
    startAt: slot.start,
    endAt: end,
    patientTimezone: body.patientTimezone,
    policyVersion: PRIVACY_POLICY_VERSION,
    consentAcceptedAt: now,
    consentIp: meta.ipAddress ?? null,
    consentUserAgent: meta.userAgent ?? null,
  }, now);
  return { request: toPortalRequestDto(await bookingRequestRepository.findForDto(request.id, tx)), expiredIds };
}

/**
 * After commit: the patient's receipt and, without the scheduler, the provider notice and the `expired` notices for
 * holds expired on the way. All best effort.
 */
export async function afterRequestCreated(held: HeldSlot): Promise<void> {
  await sendRequestReceipt(held.request.id);
  await deliverBookingRequestNotificationsNow('received', [ held.request.id ]);
  await deliverExpiredHoldsNow(held.expiredIds);
}

export const portalRequestService = {
  async list(session: PortalSessionContext): Promise<PortalRequestDto[]> {
    const own = ownRequestWhere(session.contact);
    if (!own) return [];
    const rows = await bookingRequestRepository.listLiveOwn(session.userId, own, new Date());
    return rows.map(toPortalRequestDto);
  },

  async cancel(session: PortalSessionContext, requestId: string, meta: ConsentRequestMeta): Promise<void> {
    const { userId } = session;
    const own = ownRequestWhere(session.contact);
    if (!own) throw new PortalRequestNotFoundError();
    const auditContext = portalPatientAuditContext({ userId, contact: session.contact, ipAddress: meta.ipAddress });

    await runInAuditContext(auditContext, () => prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const now = new Date();
      const request = await bookingRequestRepository.findLiveOwn(userId, own, requestId, now, tx);
      if (!request) throw new PortalRequestNotFoundError();
      await bookingRequestRepository.cancel(request.id, now, tx);
      await logAudit({
        entityType: EntityType.BOOKING_REQUEST,
        entityId: request.id,
        userId,
        actionType: ActionType.UPDATE,
        description: 'Solicitud de reserva cancelada por el paciente desde el portal',
        affectedFields: [ 'status' ],
        fieldsBefore: { status: BookingRequestStatus.PENDING },
        fieldsAfter: { status: BookingRequestStatus.CANCELLED },
        tx,
        required: true,
      });
    }, { timeout: 10000 }));
    logger.info({ requestId, userId }, 'Booking request cancelled by the patient in the portal');
  },
};
