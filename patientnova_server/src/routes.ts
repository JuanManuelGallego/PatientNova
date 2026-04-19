import { Router, type Request, type Response } from 'express';
import { getMessageStatus } from './twilio/twilioClient.js';
import { prisma } from './prisma/prismaClient.js';
import { apiError, ok } from './utils/apiUtils.js';

export const router = Router();

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
    apiError(res, 'Service unhealthy: Database connection failed', 503);
  }
});

/**
 * GET /messages/:messageSid
 * Fetch live delivery status from Twilio for a sent message.
 */
router.get('/messages/:messageSid', async (req: Request, res: Response) => {
  const messageSid = typeof req.params.messageSid === 'string' ? req.params.messageSid : undefined;
  if (!messageSid) {
    apiError(res, 'Missing messageSid parameter', 400);
    return;
  }

  try {
    const status = await getMessageStatus(messageSid);
    ok(res, status);
  } catch (err) {
    apiError(res, 'Failed to fetch message status', 500);
  }
});

