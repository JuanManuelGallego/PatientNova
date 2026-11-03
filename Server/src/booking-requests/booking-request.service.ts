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
    return ids;
  },

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
