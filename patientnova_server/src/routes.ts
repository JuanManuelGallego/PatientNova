import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getMessageStatus } from './twilio/twilioClient.js';
import { prisma } from './prisma/prismaClient.js';
import { apiError, ok } from './utils/apiUtils.js';
import { logger } from './utils/logger.js';

export const router = Router();

const messageStatusLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => { apiError(res, 'Too many message status requests — please slow down.', 429); },
});

/**
 * GET /health
 * Comprehensive health check — verifies database connectivity and service status.
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`; // Verify DB connectivity
    ok(res, {
      service: 'patient-nova-server',
      uptime: process.uptime(),
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error({ err }, 'Health check failed: database connection error');
    apiError(res, 'Service unhealthy: Database connection failed', 503);
  }
});

/**
 * GET /messages/:messageSid
 * Fetch live delivery status from Twilio for a sent message.
 */
router.get('/messages/:messageSid', messageStatusLimit, async (req: Request, res: Response) => {
  const messageSid = typeof req.params.messageSid === 'string' ? req.params.messageSid : undefined;
  if (!messageSid || !/^(SM|MM)[0-9a-f]{32}$/i.test(messageSid)) {
    apiError(res, 'Invalid or missing messageSid parameter', 400);
    return;
  }

  try {
    const status = await getMessageStatus(messageSid);
    ok(res, status);
  } catch (err) {
    logger.error({ err, messageSid }, 'Failed to fetch message status from Twilio');
    apiError(res, 'Failed to fetch message status', 500);
  }
});

