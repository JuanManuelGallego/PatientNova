import { deliverBookingNotification, type BookingNotificationJob } from '../../portal/portal-booking-notifications.js';

export async function portalBookingNotifyWorker([ job ]: Array<{ data: BookingNotificationJob }>): Promise<void> {
  if (!job) return;
  await deliverBookingNotification(job.data);
}
