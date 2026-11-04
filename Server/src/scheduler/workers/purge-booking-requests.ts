import { logger } from '../../utils/api/logger.js';
import { bookingRequestService } from '../../booking-requests/booking-request.service.js';

export async function purgeBookingRequestsWorker(): Promise<void> {
  const count = await bookingRequestService.purgeResolved();
  if (count > 0) logger.info({ count }, 'Purged resolved booking requests');
}
