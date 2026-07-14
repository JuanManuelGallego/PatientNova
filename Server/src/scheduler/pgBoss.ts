import { PgBoss } from 'pg-boss';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { sendReminderWorker } from './workers/sendReminder.js';
import { trackDeliveryWorker } from './workers/trackDelivery.js';
import { dailyReminderWorker } from './workers/dailyReminder.js';

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

  // Create queues (idempotent across reboots).
  // Workers and schedules are registered in later migration phases so that
  // node-cron remains the sole actor during Phase 1 (no behavior change).
  // The dead-letter queue must be created BEFORE the queue that references it.
  await boss.createQueue('send-reminder-dlq', {
    deleteAfterSeconds: 30 * 24 * 60 * 60,
  });

  await boss.createQueue('send-reminder', {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    retryDelayMax: 900,
    deadLetter: 'send-reminder-dlq',
  });

  await boss.createQueue('track-delivery');
  await boss.createQueue('daily-reminder', { retryLimit: 2, retryDelay: 30 });
  await boss.createQueue('complete-appointments', { retryLimit: 2, retryDelay: 30 });

  // --- Register workers (Phase 3+) ---
  // Phase 3: send-reminder worker.
  // Phase 4: track-delivery worker (recurring, every 5 min).
  // daily-reminder / complete-appointments workers are registered in later phases.
  boss.work('send-reminder', sendReminderWorker);
  boss.work('track-delivery', { batchSize: 100 }, trackDeliveryWorker);
  boss.work('daily-reminder', dailyReminderWorker);

  // --- Register schedules (use key to prevent duplicate rows on re-boot) ---
  // Phase 4: track-delivery, every 5 minutes.
  // Phase 5: daily-reminder, hourly (Decision A).
  // complete-appointments (every 15 min) schedule is registered in Phase 6;
  // node-cron still owns it until then.
  await boss.schedule('track-delivery', '*/5 * * * *', null, { key: 'every-5min' });
  await boss.schedule('daily-reminder', '0 * * * *', null, { key: 'every-hour' });

  logger.info('pg-boss initialized (queues created)');
}

export async function stopPgBoss(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true });
    boss = null;
    logger.info('pg-boss stopped');
  }
}
