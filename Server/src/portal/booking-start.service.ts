import { ActionType, BookingRequestStatus, Channel, EntityType } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { ONE_HOUR_MS, ONE_MINUTE_MS } from '../utils/config/constants.js';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { phoneHash } from '../utils/encryption/blind-index.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { portalAnonymousAuditContext } from '../audit-log/audit-actors.js';
import { bookingRequestRepository } from '../booking-requests/booking-request.repository.js';
import { bookingRequestService } from '../booking-requests/booking-request.service.js';
import { deliverExpiredHoldsNow } from '../booking-requests/booking-request-notifications.js';
import { hashRequestToken, issueRequestToken } from '../booking-requests/request-token.js';
import {
  EMAIL_SENDS_PER_HOUR,
  MAX_PENDING_REQUESTS_PER_CONTACT,
  MAX_UNCONFIRMED_PER_PROVIDER,
} from '../booking-requests/booking-request.constants.js';
import { dispatchMessage } from '../scheduler/dispatch.js';
import { isSlotFree, providerDisplayName, publicBookingService } from '../public-booking/public-booking.service.js';
import type { ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { PRIVACY_POLICY_VERSION } from './privacy-policy.js';
import { emailContact, isPhoneContact, ownRequestWhere, type PortalContact } from './portal-contact.js';
import { checkPaidCaps } from './portal-paid-caps.js';
import { confirmationUrl, providerContactOf, renderPatientNotice } from './patient-notices.js';
import { requireBookableTarget, resolveBookingMode, toPortalError } from './portal-booking.service.js';
import { PortalRequestLimitError, SlotUnavailableError } from './portal-booking.errors.js';
import { toBookingPendingDto, type BookingPendingDto } from './booking-confirmation.dto.js';
import {
  BookingHoldCapacityError,
  BookingReleaseNotFoundError,
  ConfirmationLinkNotSentError,
  WhatsAppUnavailableError,
} from './booking-confirmation.errors.js';
import type { StartBookingBody } from './portal-booking.schemas.js';

type Provider = Awaited<ReturnType<typeof publicBookingService.resolveProvider>>;

const contactOf = (body: StartBookingBody): PortalContact =>
  body.contact.channel === 'EMAIL' ? emailContact(body.contact.email) : { channel: Channel.WHATSAPP, value: body.contact.phone };

async function enforceCaps(tx: TransactionClient, userId: string, contact: PortalContact, now: Date): Promise<void> {
  const own = ownRequestWhere(contact);
  if (!own) throw new PortalRequestLimitError();
  if (await bookingRequestRepository.countLiveUnconfirmed(userId, now, tx, own) >= MAX_PENDING_REQUESTS_PER_CONTACT) {
    throw new PortalRequestLimitError();
  }
  if (await bookingRequestRepository.countLiveUnconfirmed(userId, now, tx) >= MAX_UNCONFIRMED_PER_PROVIDER) {
    throw new BookingHoldCapacityError();
  }
  if (!isPhoneContact(contact)) {
    const hourAgo = new Date(now.getTime() - ONE_HOUR_MS);
    if (await bookingRequestRepository.countCreatedSince(userId, hourAgo, tx, own) >= EMAIL_SENDS_PER_HOUR) {
      throw new BookingHoldCapacityError();
    }
    return;
  }
  const reason = await checkPaidCaps(tx, userId, phoneHash(contact.value)!, now);
  if (reason) {
    logger.error(`Portal WhatsApp cap reached: ${reason}`);
    throw new WhatsAppUnavailableError();
  }
}

interface ConfirmLink {
  requestId: string;
  contact: PortalContact;
  token: string;
  provider: Provider;
  startAt: Date;
  patientTimezone: string;
  approvalRequired: boolean;
  place: { locationName: string; address: string | null };
}

async function sendConfirmLink(link: ConfirmLink): Promise<boolean> {
  try {
    const opts = renderPatientNotice('confirm-link', {
      providerName: providerDisplayName(link.provider),
      at: link.startAt,
      timezone: link.patientTimezone,
      ...link.place,
      token: link.token,
      confirmUrl: confirmationUrl(link.token),
      approvalRequired: link.approvalRequired,
      providerContact: providerContactOf(link.provider),
    }, { channel: link.contact.channel, to: link.contact.value });
    const result = await dispatchMessage(link.contact.channel, opts);
    if (!result.success) {
      logger.error({ requestId: link.requestId, channel: link.contact.channel }, 'Booking confirmation link was not accepted');
      return false;
    }
  } catch (err) {
    logger.error({ requestId: link.requestId, errorName: err instanceof Error ? err.name : undefined }, 'Booking confirmation link failed');
    return false;
  }
  try {
    await bookingRequestRepository.markConfirmationSent(link.requestId, new Date());
  } catch (err) {
    logger.error({ requestId: link.requestId, errorName: err instanceof Error ? err.name : undefined }, 'Booking confirmation link not marked as sent');
  }
  return true;
}

async function releaseUnsent(requestId: string, userId: string, ipAddress: string | undefined): Promise<void> {
  try {
    await runInAuditContext(portalAnonymousAuditContext({ userId, ipAddress }), () => prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const row = await tx.bookingRequest.findUnique({ where: { id: requestId }, select: { status: true } });
      if (row?.status !== BookingRequestStatus.UNCONFIRMED) return;
      await bookingRequestRepository.cancel(requestId, new Date(), tx, 'system');
      await logAudit({
        entityType: EntityType.BOOKING_REQUEST,
        entityId: requestId,
        userId,
        actionType: ActionType.UPDATE,
        description: 'Reserva sin confirmar liberada: no se pudo enviar el enlace de confirmación',
        affectedFields: [ 'status' ],
        fieldsBefore: { status: BookingRequestStatus.UNCONFIRMED },
        fieldsAfter: { status: BookingRequestStatus.CANCELLED },
        tx,
        required: true,
      });
    }, { timeout: 10000 }));
  } catch (err) {
    logger.error({ requestId, errorName: err instanceof Error ? err.name : undefined }, 'Unsent booking hold was not released');
  }
}

export const bookingStartService = {
  async start(slug: string, body: StartBookingBody, meta: ConsentRequestMeta): Promise<BookingPendingDto> {
    const provider = await publicBookingService.resolveProvider(slug, 'reachable');
    const userId = provider.id;
    const contact = contactOf(body);
    if (isPhoneContact(contact) && !config.twilio.patientPortal.confirmLinkSid) throw new WhatsAppUnavailableError();
    const confirm = issueRequestToken();
    const release = issueRequestToken();
    const start = new Date(body.startUtc);

    try {
      const outcome = await runInAuditContext(portalAnonymousAuditContext({ userId, ipAddress: meta.ipAddress }), () =>
        prisma.$transaction(async (tx) => {
          await withProviderLock(tx, userId);
          const { settings, approval } = await resolveBookingMode(userId, tx);
          const { type, location } = await requireBookableTarget(userId, body, tx);

          const now = new Date();
          if (!(await isSlotFree(userId, settings, type.defaultDuration, start, now, { tx }))) throw new SlotUnavailableError();
          await enforceCaps(tx, userId, contact, now);

          const { request, expiredIds } = await bookingRequestService.createUnconfirmedWithin(tx, userId, {
            contactChannel: contact.channel,
            email: isPhoneContact(contact) ? null : contact.value,
            verifiedPhone: isPhoneContact(contact) ? contact.value : null,
            name: body.patient.name,
            lastName: body.patient.lastName,
            phone: body.patient.phone || null,
            typeId: type.id,
            locationId: location.id,
            startAt: start,
            endAt: new Date(start.getTime() + type.defaultDuration * ONE_MINUTE_MS),
            patientTimezone: body.patientTimezone,
            policyVersion: PRIVACY_POLICY_VERSION,
            consentAcceptedAt: now,
            consentIp: meta.ipAddress ?? null,
            consentUserAgent: meta.userAgent ?? null,
            confirmTokenHash: confirm.hash,
            releaseTokenHash: release.hash,
          }, now);
          return { request, expiredIds, approval, location };
        }, { timeout: 10000 }),
      );

      const sent = await sendConfirmLink({
        requestId: outcome.request.id,
        contact,
        token: confirm.token,
        provider,
        startAt: start,
        patientTimezone: body.patientTimezone,
        approvalRequired: outcome.approval,
        place: { locationName: outcome.location.name, address: outcome.location.isVirtual ? null : outcome.location.address },
      });
      await deliverExpiredHoldsNow(outcome.expiredIds);
      if (!sent) {
        await releaseUnsent(outcome.request.id, userId, meta.ipAddress);
        throw new ConfirmationLinkNotSentError();
      }
      return toBookingPendingDto(outcome.request, contact, outcome.approval, release.token);
    } catch (err) {
      throw toPortalError(err);
    }
  },

  async release(releaseToken: string, meta: ConsentRequestMeta): Promise<void> {
    const hash = hashRequestToken(releaseToken);
    await prisma.$transaction(async (tx) => {
      const found = await bookingRequestRepository.findByReleaseTokenHash(hash, tx);
      if (!found) throw new BookingReleaseNotFoundError();
      const { userId } = found;
      await runInAuditContext(portalAnonymousAuditContext({ userId, ipAddress: meta.ipAddress }), async () => {
        await withProviderLock(tx, userId);
        const now = new Date();
        const request = await bookingRequestRepository.findByReleaseTokenHash(hash, tx);
        if (!request || request.status !== BookingRequestStatus.UNCONFIRMED || request.holdExpiresAt <= now) {
          throw new BookingReleaseNotFoundError();
        }
        await bookingRequestRepository.cancel(request.id, now, tx);
        await logAudit({
          entityType: EntityType.BOOKING_REQUEST,
          entityId: request.id,
          userId,
          actionType: ActionType.UPDATE,
          description: 'Reserva sin confirmar liberada por el paciente',
          affectedFields: [ 'status' ],
          fieldsBefore: { status: BookingRequestStatus.UNCONFIRMED },
          fieldsAfter: { status: BookingRequestStatus.CANCELLED },
          tx,
          required: true,
        });
      });
    }, { timeout: 10000 });
  },
};
