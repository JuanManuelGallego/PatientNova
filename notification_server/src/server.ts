import app from "./app.js";
import { config } from "./utils/config.js";
import { logger } from "./utils/logger.js";
import { prisma } from "./prisma/prismaClient.js";

async function start() {
  await prisma.$connect();
  logger.info('Database connected');

  const server = app.listen(config.port, () => {
    logger.info(`Server running on http://localhost:${config.port}`);
    logger.info(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });

  async function gracefulShutdown() {
    logger.info('Shutting down gracefully...');
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });

    // Force shutdown after 10 seconds
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