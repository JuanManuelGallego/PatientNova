import {
  deliverBookingRequestNotification,
  type BookingRequestNotificationJob,
} from '../../booking-requests/booking-request-notifications.js';

export async function bookingRequestNotifyWorker([ job ]: Array<{ data: BookingRequestNotificationJob }>): Promise<void> {
  if (!job) return;
  await deliverBookingRequestNotification(job.data);
}
