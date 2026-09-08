import app from "./app.js";
import cron from "node-cron";
import { config } from "./utils/config/config.js";
import { logger } from "./utils/api/logger.js";
import { prisma } from "./utils/prisma/prisma-client.js";
import { initializePgBoss, stopPgBoss } from "./scheduler/pg-boss.js";
import { reconcileScheduledReminders } from "./scheduler/reconcile-scheduled-reminder.js";

const RECONCILIATION_CRON = '0 */12 * * *';
let reconciliationTask: ReturnType<typeof cron.schedule> | undefined;

async function start() {
  await prisma.$connect();
  logger.info('Database connected');

  if (config.scheduler.enabled) {
    await initializePgBoss();
    await reconcileScheduledReminders();
    reconciliationTask = cron.schedule(RECONCILIATION_CRON, () => {
      reconcileScheduledReminders().catch((error) => {
        logger.error({ error }, 'Scheduled reminder reconciliation failed');
      });
    });
  } else {
    logger.info('Schedulers disabled via config');
  }

  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`);
    logger.info(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });

  async function gracefulShutdown() {
    logger.info('Shutting down gracefully...');
    if (reconciliationTask) {
      reconciliationTask.stop();
      reconciliationTask = undefined;
    }

    // Give pg-boss time to finish active jobs before closing.
    await Promise.race([
      stopPgBoss(),
      new Promise(resolve => setTimeout(resolve, 8000)),
    ]);

    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
