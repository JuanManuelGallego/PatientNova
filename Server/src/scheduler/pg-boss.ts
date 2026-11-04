import { PgBoss } from 'pg-boss';
import { config } from '../utils/config/config.js';
import { REMINDER_SEND_RETRY_LIMIT, BULK_SEND_CONCURRENCY, PROVISION_MEET_RETRY_LIMIT } from '../utils/config/constants.js';
import { logger } from '../utils/api/logger.js';
import { sendReminderWorker } from './workers/send-reminder.js';
import { trackDeliveryWorker } from './workers/track-delivery.js';
import { dailyReminderWorker } from './workers/daily-reminder.js';
import { completeAppointmentsWorker } from './workers/complete-appointments.js';
import { bulkSendWorker } from './workers/bulk-send-message.js';
import { purgePortalOtpsWorker } from './workers/purge-portal-otps.js';
import { portalBookingNotifyWorker } from './workers/portal-booking-notify.js';
import { checkGoogleConnectionsWorker } from './workers/check-google-connections.js';
import { provisionMeetWorker } from './workers/provision-meet.js';
import { sweepPendingMeetingsWorker } from './workers/sweep-pending-meetings.js';
import { bookingRequestNotifyWorker } from './workers/booking-request-notify.js';
import { sweepBookingRequestsWorker } from './workers/sweep-booking-requests.js';
import { purgeBookingRequestsWorker } from './workers/purge-booking-requests.js';

let boss: PgBoss | null = null;

export function getBoss(): PgBoss {
  if (!boss) throw new Error('pg-boss not initialized');
  return boss;
}

export async function initializePgBoss(): Promise<void> {
  boss = new PgBoss({
    connectionString: config.databaseUrl,
    schema: 'pgboss',
  });

  boss.on('error', (error) => {
    logger.error({ error }, 'pg-boss error');
  });

  boss.on('failed', (err) => {
    logger.error({ jobId: err.data?.id, queue: err.queue, error: err.message }, 'pg-boss job failed');
  });

  await boss.start();

  await boss.createQueue('send-reminder-dlq', {
    deleteAfterSeconds: 30 * 24 * 60 * 60,
  });

  await boss.createQueue('send-reminder', {
    retryLimit: REMINDER_SEND_RETRY_LIMIT,
    retryDelay: 60,
    retryBackoff: true,
    retryDelayMax: 900,
    deadLetter: 'send-reminder-dlq',
  });

  await boss.createQueue('bulk-send-message-dlq', {
    deleteAfterSeconds: 30 * 24 * 60 * 60,
  });

  await boss.createQueue('bulk-send-message', {
    retryLimit: REMINDER_SEND_RETRY_LIMIT,
    retryDelay: 60,
    retryBackoff: true,
    retryDelayMax: 900,
    deadLetter: 'bulk-send-message-dlq',
  });

  await boss.createQueue('track-delivery');
  await boss.createQueue('daily-reminder', { retryLimit: 2, retryDelay: 30 });
  await boss.createQueue('complete-appointments', { retryLimit: 2, retryDelay: 30 });
  await boss.createQueue('purge-portal-otps', { retryLimit: 2, retryDelay: 300 });
  await boss.createQueue('check-google-connections', { retryLimit: 2, retryDelay: 300 });
  await boss.createQueue('portal-booking-notify', {
    retryLimit: REMINDER_SEND_RETRY_LIMIT,
    retryDelay: 60,
    retryBackoff: true,
    retryDelayMax: 900,
  });

  await boss.createQueue('provision-meet', {
    retryLimit: PROVISION_MEET_RETRY_LIMIT,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 600,
  });
  await boss.createQueue('sweep-pending-meetings', { retryLimit: 2, retryDelay: 60 });
  await boss.createQueue('booking-request-notify', {
    retryLimit: REMINDER_SEND_RETRY_LIMIT,
    retryDelay: 60,
    retryBackoff: true,
    retryDelayMax: 900,
  });
  await boss.createQueue('sweep-booking-requests', { retryLimit: 2, retryDelay: 60 });
  await boss.createQueue('purge-booking-requests', { retryLimit: 2, retryDelay: 300 });

  boss.work('send-reminder', sendReminderWorker);
  boss.work('bulk-send-message', { batchSize: BULK_SEND_CONCURRENCY, concurrency: BULK_SEND_CONCURRENCY }, bulkSendWorker);
  boss.work('track-delivery', { batchSize: 100 }, trackDeliveryWorker);
  boss.work('daily-reminder', dailyReminderWorker);
  boss.work('complete-appointments', completeAppointmentsWorker);
  boss.work('purge-portal-otps', purgePortalOtpsWorker);
  boss.work('portal-booking-notify', portalBookingNotifyWorker);
  boss.work('check-google-connections', checkGoogleConnectionsWorker);
  boss.work('provision-meet', provisionMeetWorker);
  boss.work('sweep-pending-meetings', sweepPendingMeetingsWorker);
  boss.work('booking-request-notify', bookingRequestNotifyWorker);
  boss.work('sweep-booking-requests', sweepBookingRequestsWorker);
  boss.work('purge-booking-requests', purgeBookingRequestsWorker);

  await boss.schedule('track-delivery', '0 * * * *', null, { key: 'every-hour' });
  await boss.schedule('daily-reminder', '0 * * * *', null, { key: 'every-hour' });
  await boss.schedule('complete-appointments', '*/15 * * * *', null, { key: 'every-15min' });
  await boss.schedule('sweep-pending-meetings', '*/15 * * * *', null, { key: 'every-15min' });
  await boss.schedule('sweep-booking-requests', '*/15 * * * *', null, { key: 'every-15min' });
  await boss.schedule('purge-portal-otps', '30 3 * * *', null, { key: 'daily' });
  await boss.schedule('purge-booking-requests', '45 3 * * *', null, { key: 'daily' });
  // 11:00 UTC = 06:00 in Bogotá: expired connections show up before the working day.
  await boss.schedule('check-google-connections', '0 11 * * *', null, { key: 'daily' });

  logger.info('pg-boss initialized (queues created)');
}

export async function stopPgBoss(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true });
    boss = null;
    logger.info('pg-boss stopped');
  }
}
