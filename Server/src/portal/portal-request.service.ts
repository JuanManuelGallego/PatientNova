import { ActionType, BookingRequestStatus, EntityType } from '../../generated/prisma/enums.js';
import { prisma } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { logger } from '../utils/api/logger.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { portalPatientAuditContext } from '../audit-log/audit-actors.js';
import { bookingRequestRepository } from '../booking-requests/booking-request.repository.js';
import type { ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { ownRequestWhere } from './portal-contact.js';
import { PortalRequestNotFoundError } from './portal-booking.errors.js';
import { toPortalRequestDto, type PortalRequestDto } from './portal-request.dto.js';
import type { PortalSessionContext } from './portal-session.middleware.js';

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
