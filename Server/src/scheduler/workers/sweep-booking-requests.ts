import { logger } from '../../utils/api/logger.js';
import { bookingRequestService } from '../../booking-requests/booking-request.service.js';

/** Expiry audits run under the `booking-request-expiry` system actor set inside `expireStaleWithin`. */
export async function sweepBookingRequestsWorker(): Promise<void> {
  const { expired, nudged } = await bookingRequestService.sweep();
  if (expired > 0 || nudged > 0) logger.info({ expired, nudged }, 'Booking requests swept');
}
