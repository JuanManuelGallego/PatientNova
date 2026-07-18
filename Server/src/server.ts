import app from "./app.js";
import { config } from "./utils/config.js";
import { logger } from "./utils/logger.js";
import { prisma } from "./prisma/prismaClient.js";
import { initializePgBoss, stopPgBoss } from "./scheduler/pgBoss.js";

async function start() {
  await prisma.$connect();
  logger.info('Database connected');

  if (config.scheduler.enabled) {
    await initializePgBoss();
  } else {
    logger.info('Schedulers disabled via config');
  }

  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`);
    logger.info(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });

  async function gracefulShutdown() {
    logger.info('Shutting down gracefully...');

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