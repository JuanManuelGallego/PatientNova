import { PgBoss } from 'pg-boss';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { sendReminderWorker } from './workers/sendReminder.js';

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
  // Phase 3: send-reminder worker. track-delivery / daily / complete workers
  // are registered in later migration phases.
  boss.work('send-reminder', sendReminderWorker);

  logger.info('pg-boss initialized (queues created)');
}

export async function stopPgBoss(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true });
    boss = null;
    logger.info('pg-boss stopped');
  }
}
