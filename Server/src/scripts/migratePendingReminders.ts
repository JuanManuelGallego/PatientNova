import { prisma } from '../prisma/prismaClient.js';
import { PgBoss } from 'pg-boss';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run the reminder migration');
}

async function migrate() {
  const boss = new PgBoss({ connectionString: DATABASE_URL!, schema: 'pgboss' });

  await boss.start();

  // Defensive: ensure the queues exist even if Phase 1 hasn't run against this DB yet.
  // The dead-letter queue must be created BEFORE the queue that references it.
  await boss.createQueue('send-reminder-dlq', { deleteAfterSeconds: 30 * 24 * 60 * 60 });
  await boss.createQueue('send-reminder', {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    retryDelayMax: 900,
    deadLetter: 'send-reminder-dlq',
  });

  // Check for existing jobs to make the script idempotent (safe to re-run).
  const existingJobs = await boss.findJobs('send-reminder', { queued: true });
  const migratedIds = new Set(existingJobs.map((j) => (j.data as { reminderId?: string }).reminderId));

  const pending = await prisma.reminder.findMany({
    where: {
      status: 'PENDING',
      isDeleted: false,
      sendAt: { gt: new Date() },
    },
    select: { id: true, sendAt: true, sendMode: true },
  });

  console.log(`Found ${pending.length} pending reminders to migrate`);

  let enqueued = 0;
  let skipped = 0;

  for (const reminder of pending) {
    if (migratedIds.has(reminder.id)) {
      console.log(`Reminder ${reminder.id} already migrated — skipping`);
      skipped++;
      continue;
    }

    const options =
      reminder.sendMode === 'IMMEDIATE' ? {} : { startAfter: new Date(reminder.sendAt) };

    await boss.send('send-reminder', { reminderId: reminder.id }, options);
    console.log(`Enqueued reminder ${reminder.id}`);
    enqueued++;
  }

  await boss.stop({ graceful: true });
  await prisma.$disconnect().catch(() => undefined);
  console.log(`Migration complete: ${enqueued} enqueued, ${skipped} skipped`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
