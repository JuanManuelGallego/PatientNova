import { ActionType, BookingRequestStatus, EntityType } from '../../generated/prisma/enums.ts';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { bookingRequestExpiryAuditContext } from '../audit-log/audit-actors.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { logger } from '../utils/api/logger.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { bookingRequestRepository, type CreateBookingRequestData } from './booking-request.repository.js';
import { ONE_DAY_MS, ONE_HOUR_MS } from '../utils/config/constants.js';
import { NUDGE_HOURS, RESOLVED_RETENTION_DAYS, holdExpiry, isNudgeDue } from './booking-request.constants.js';
import { enqueueBookingRequestNotifications } from './booking-request-notifications.js';

export type NewBookingRequest = Omit<CreateBookingRequestData, 'userId' | 'holdExpiresAt'>;

export const bookingRequestService = {
  async expireStaleWithin(tx: TransactionClient, userId: string, now: Date): Promise<string[]> {
    await withProviderLock(tx, userId);
    const stale = await bookingRequestRepository.findStale(userId, now, tx);
    const ids = stale.map((s) => s.id);
    await bookingRequestRepository.markExpired(ids, now, tx);
    await runInAuditContext(bookingRequestExpiryAuditContext(userId), async () => {
      for (const id of ids) {
        await logAudit({
          entityType: EntityType.BOOKING_REQUEST,
          entityId: id,
          userId,
          actionType: ActionType.UPDATE,
          description: 'Solicitud de reserva vencida',
          affectedFields: [ 'status' ],
          fieldsBefore: { status: BookingRequestStatus.PENDING },
          fieldsAfter: { status: BookingRequestStatus.EXPIRED },
          tx,
          required: true,
        });
      }
    });
    await enqueueBookingRequestNotifications('expired', ids, tx);
    return ids;
  },

  /**
   * `expiredIds`: stale holds this call expired first. Without the scheduler the caller must deliver their `expired`
   * notices after commit (`deliverBookingRequestNotificationsNow`).
   */
  async createHoldWithin(tx: TransactionClient, userId: string, input: NewBookingRequest, now: Date) {
    const expiredIds = await bookingRequestService.expireStaleWithin(tx, userId, now);
    const request = await bookingRequestRepository.create(
      { ...input, userId, holdExpiresAt: holdExpiry(now, input.startAt) },
      tx,
    );
    await logAudit({
      entityType: EntityType.BOOKING_REQUEST,
      entityId: request.id,
      userId,
      actionType: ActionType.CREATE,
      description: 'Solicitud de reserva creada desde el portal',
      affectedFields: [ 'status', 'startAt', 'endAt', 'typeId', 'locationId', 'holdExpiresAt' ],
      fieldsAfter: {
        status: request.status,
        startAt: request.startAt,
        endAt: request.endAt,
        typeId: request.typeId,
        locationId: request.locationId,
        holdExpiresAt: request.holdExpiresAt,
      },
      tx,
      required: true,
    });
    await enqueueBookingRequestNotifications('received', [ request.id ], tx);
    return { request, expiredIds };
  },

  /**
   * The 15-minute sweep: expire stale holds per provider (each under its own lock, emailing the patient), then nudge
   * each provider once about requests past the middle of their hold. Correctness never depends on it: the clock
   * already releases expired holds.
   */
  async sweep(now: Date = new Date()): Promise<{ expired: number; nudged: number }> {
    let expired = 0;
    for (const userId of await bookingRequestRepository.providersWithStale(now)) {
      try {
        const ids = await prisma.$transaction((tx) => bookingRequestService.expireStaleWithin(tx, userId, now), { timeout: 10000 });
        expired += ids.length;
      } catch (err) {
        logger.error({ userId, err }, 'Booking request expiry failed for a provider');
      }
    }

    let nudged = 0;
    const candidates = await bookingRequestRepository.findNudgeCandidates(now, NUDGE_HOURS * ONE_HOUR_MS);
    for (const c of candidates.filter((c) => isNudgeDue(c.createdAt, c.holdExpiresAt, now))) {
      const claimed = await prisma.$transaction(async (tx) => {
        if (!(await bookingRequestRepository.markNudged(c.id, now, tx))) return false;
        await enqueueBookingRequestNotifications('nudge', [ c.id ], tx);
        return true;
      });
      if (claimed) nudged++;
    }
    return { expired, nudged };
  },

  async purgeResolved(now: Date = new Date()): Promise<number> {
    return bookingRequestRepository.purgeResolvedBefore(new Date(now.getTime() - RESOLVED_RETENTION_DAYS * ONE_DAY_MS));
  },
};
