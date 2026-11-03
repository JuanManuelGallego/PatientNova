import { ActionType, BookingRequestKind, BookingRequestStatus, EntityType } from '../../generated/prisma/enums.js';
import { deliverBookingRequestNotificationsNow } from '../booking-requests/booking-request-notifications.js';
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

export async function holdSlotWithin(
  tx: TransactionClient,
  session: PortalSessionContext,
  body: CreatePortalBookingBody,
  meta: ConsentRequestMeta,
  slot: { settings: SlotSettings; typeId: string; locationId: string; durationMinutes: number; start: Date },
  kind: BookingRequestKind = BookingRequestKind.NEW,
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
  if (forEmail >= MAX_PENDING_REQUESTS_PER_EMAIL) throw new PortalRequestLimitError();
  if (forProvider >= MAX_PENDING_REQUESTS_PER_PROVIDER) throw new PortalRequestCapacityError();

  const request = await bookingRequestService.createHoldWithin(tx, userId, {
    kind,
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

async function sendRequestReceivedEmail(userId: string, to: string): Promise<void> {
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

/** After commit: the patient's receipt and, without the scheduler, the provider notice. Both best effort. */
export async function afterRequestCreated(userId: string, to: string, requestId: string): Promise<void> {
  await sendRequestReceivedEmail(userId, to);
  await deliverBookingRequestNotificationsNow('received', [ requestId ]);
}

export const portalRequestService = {
  async list(session: PortalSessionContext): Promise<PortalRequestDto[]> {
    const hash = emailHash(session.email);
    if (!hash) return [];
    const rows = await bookingRequestRepository.listLiveForEmail(session.userId, hash, new Date());
    return rows.map(toPortalRequestDto);
  },

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
