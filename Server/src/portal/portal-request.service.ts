import { ActionType, BookingRequestStatus, EntityType } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { ONE_MINUTE_MS } from '../utils/config/constants.js';
import { logger, maskEmail } from '../utils/api/logger.js';
import { emailHash } from '../utils/encryption/blind-index.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { portalPatientAuditContext } from '../audit-log/audit-actors.js';
import { sendTransactionalEmail } from '../brevo/transactional.js';
import { renderBookingRequestReceivedEmail } from '../brevo/email-templates.js';
import { bookingRequestRepository } from '../booking-requests/booking-request.repository.js';
import { bookingRequestService } from '../booking-requests/booking-request.service.js';
import {
  MAX_PENDING_REQUESTS_PER_EMAIL,
  MAX_PENDING_REQUESTS_PER_PROVIDER,
} from '../booking-requests/booking-request.constants.js';
import { bookingUrl } from '../booking-settings/booking-settings.service.js';
import { isSlotFree, providerDisplayName, type SlotSettings } from '../public-booking/public-booking.service.js';
import type { ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { PRIVACY_POLICY_VERSION } from './privacy-policy.js';
import {
  PortalRequestCapacityError,
  PortalRequestLimitError,
  PortalRequestNotFoundError,
  SlotUnavailableError,
} from './portal-booking.errors.js';
import { toPortalRequestDto, type PortalRequestDto } from './portal-request.dto.js';
import type { CreatePortalBookingBody } from './portal-booking.schemas.js';
import type { PortalSessionContext } from './portal-session.middleware.js';

/**
 * Approval mode: the patient's booking becomes a PENDING request that holds the slot. Runs inside the booking
 * transaction AFTER the provider lock, the live/mode gate and the bookable type/location checks.
 * Never looks up or creates a patient or a consent row (those happen on approval), so the answer is the same
 * whether or not the email belongs to a patient.
 */
export async function holdSlotWithin(
  tx: TransactionClient,
  session: PortalSessionContext,
  body: CreatePortalBookingBody,
  meta: ConsentRequestMeta,
  slot: { settings: SlotSettings; typeId: string; locationId: string; durationMinutes: number; start: Date },
): Promise<PortalRequestDto> {
  const { userId } = session;
  const now = new Date();
  const end = new Date(slot.start.getTime() + slot.durationMinutes * ONE_MINUTE_MS);
  if (!(await isSlotFree(userId, slot.settings, slot.durationMinutes, slot.start, now, { tx }))) throw new SlotUnavailableError();

  const hash = emailHash(session.email);
  if (!hash) throw new PortalRequestLimitError();
  const [ forEmail, forProvider ] = await Promise.all([
    bookingRequestRepository.countLive(userId, now, tx, hash),
    bookingRequestRepository.countLive(userId, now, tx),
  ]);
  // Distinct errors: the email's own cap is about this patient; the provider-wide cap must not claim it is.
  if (forEmail >= MAX_PENDING_REQUESTS_PER_EMAIL) throw new PortalRequestLimitError();
  if (forProvider >= MAX_PENDING_REQUESTS_PER_PROVIDER) throw new PortalRequestCapacityError();

  const request = await bookingRequestService.createHoldWithin(tx, userId, {
    email: session.email,
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
  return toPortalRequestDto(await bookingRequestRepository.findForDto(request.id, tx));
}

/**
 * "We received your request" email, after commit. Best effort and never throws: the request is already
 * saved, so a failure here (provider lookup included) must not turn the 202 into an error the patient retries.
 */
export async function sendRequestReceivedEmail(userId: string, to: string): Promise<void> {
  try {
    const provider = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, firstName: true, lastName: true, bookingSlug: true },
    });
    if (!provider) return;
    const page = bookingUrl(provider.bookingSlug);
    const email = renderBookingRequestReceivedEmail({
      providerName: providerDisplayName(provider),
      appointmentsUrl: page ? `${page}/appointments` : '',
    });
    await sendTransactionalEmail(to, email);
  } catch (err) {
    logger.error({ userId, maskedTo: maskEmail(to), errorName: err instanceof Error ? err.name : undefined },
      'Booking request received email failed');
  }
}

export const portalRequestService = {
  /** The session email's live pending requests. Independent of patient/consent state: the data is their own. */
  async list(session: PortalSessionContext): Promise<PortalRequestDto[]> {
    const hash = emailHash(session.email);
    if (!hash) return [];
    const rows = await bookingRequestRepository.listLiveForEmail(session.userId, hash, new Date());
    return rows.map(toPortalRequestDto);
  },

  /** Cancels the session email's own pending request and releases its hold. Every miss is the same 404. */
  async cancel(session: PortalSessionContext, requestId: string, meta: ConsentRequestMeta): Promise<void> {
    const { userId } = session;
    const hash = emailHash(session.email);
    if (!hash) throw new PortalRequestNotFoundError();
    const auditContext = portalPatientAuditContext({ userId, email: session.email, ipAddress: meta.ipAddress });

    await runInAuditContext(auditContext, () => prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const now = new Date();
      const request = await bookingRequestRepository.findLiveOwn(userId, hash, requestId, now, tx);
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
