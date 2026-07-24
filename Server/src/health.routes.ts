import { Router, type Request, type Response } from 'express';
import { prisma } from './utils/prisma/prisma-client.js';
import { apiError, ok } from './utils/api/api-utils.js';
import { logger } from './utils/api/logger.js';

export const router = Router();

/**
 * GET /health
 * Comprehensive health check — verifies database connectivity and service status.
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok(res, {
      service: 'patient-nova-server',
      uptime: process.uptime(),
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    apiError(res, 'Service unhealthy: Database connection failed', 503);
  }
});
