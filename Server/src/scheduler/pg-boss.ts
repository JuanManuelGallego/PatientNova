import { PgBoss } from 'pg-boss';
import { config } from '../utils/config/config.js';
import { REMINDER_SEND_RETRY_LIMIT } from '../utils/config/constants.js';
import { logger } from '../utils/api/logger.js';
import { sendReminderWorker } from './workers/send-reminder.js';
import { trackDeliveryWorker } from './workers/track-delivery.js';
import { dailyReminderWorker } from './workers/daily-reminder.js';
import { completeAppointmentsWorker } from './workers/complete-appointments.js';

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

  await boss.createQueue('track-delivery');
  await boss.createQueue('daily-reminder', { retryLimit: 2, retryDelay: 30 });
  await boss.createQueue('complete-appointments', { retryLimit: 2, retryDelay: 30 });

  boss.work('send-reminder', sendReminderWorker);
  boss.work('track-delivery', { batchSize: 100 }, trackDeliveryWorker);
  boss.work('daily-reminder', dailyReminderWorker);
  boss.work('complete-appointments', completeAppointmentsWorker);

  await boss.schedule('track-delivery', '*/5 * * * *', null, { key: 'every-5min' });
  await boss.schedule('daily-reminder', '0 * * * *', null, { key: 'every-hour' });
  await boss.schedule('complete-appointments', '*/15 * * * *', null, { key: 'every-15min' }); // Phase 6

  logger.info('pg-boss initialized (queues created)');
}

export async function stopPgBoss(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true });
    boss = null;
    logger.info('pg-boss stopped');
  }
}
