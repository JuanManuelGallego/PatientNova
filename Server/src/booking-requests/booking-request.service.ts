import { ActionType, BookingRequestStatus, EntityType } from '../../generated/prisma/enums.ts';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { bookingRequestExpiryAuditContext } from '../audit-log/audit-actors.js';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { bookingRequestRepository, type CreateBookingRequestData } from './booking-request.repository.js';
import { holdExpiry } from './booking-request.constants.js';

export type NewBookingRequest = Omit<CreateBookingRequestData, 'userId' | 'holdExpiresAt'>;

export const bookingRequestService = {
  /**
   * Flips the provider's PENDING requests whose hold ran out to EXPIRED, with an audit row each, on `tx`.
   * Takes the provider lock. Run before inserting a hold: the exclusion constraint cannot look at the clock, so a
   * stale PENDING row would otherwise block its slot until the cron sweeps it.
   */
  async expireStaleWithin(tx: TransactionClient, userId: string, now: Date): Promise<string[]> {
    await withProviderLock(tx, userId);
    const stale = await bookingRequestRepository.findStale(userId, now, tx);
    const ids = stale.map((s) => s.id);
    await bookingRequestRepository.markExpired(ids, now, tx);
    // A system actor, never the caller's context (on the portal path that is another patient).
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
    return ids;
  },

  /**
   * Inserts a PENDING request that holds its slot, on `tx`. Takes the provider lock FIRST; the caller has already
   * validated the slot (`isSlotAvailable`, which counts holds). Audits the creation (required).
   * An exclusion violation (23P01) reaching the caller maps to the neutral slot-unavailable error.
   */
  async createHoldWithin(tx: TransactionClient, userId: string, input: NewBookingRequest, now: Date) {
    await bookingRequestService.expireStaleWithin(tx, userId, now);
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
    return request;
  },
};
