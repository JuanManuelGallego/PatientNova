import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getMessageStatus } from './client.js';
import { apiError, ok } from '../utils/api/api-utils.js';
import { logger } from '../utils/api/logger.js';

export const messageStatusRouter = Router();

const messageStatusLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => { apiError(res, 'Too many message status requests — please slow down.', 429); },
});

/**
 * GET /messages/:messageSid
 * Fetch live delivery status from Twilio for a sent message.
 */
messageStatusRouter.get('/messages/:messageSid', messageStatusLimit, async (req: Request, res: Response) => {
  const messageSid = typeof req.params.messageSid === 'string' ? req.params.messageSid : undefined;
  if (!messageSid || !/^(SM|MM)[0-9a-f]{32}$/i.test(messageSid)) {
    apiError(res, 'Invalid or missing messageSid parameter', 400);
    return;
  }

  try {
    const status = await getMessageStatus(messageSid);
    ok(res, status);
  } catch (err) {
    logger.error({ err, messageSid }, 'Failed to fetch message status');
    apiError(res, 'Failed to fetch message status', 500);
  }
});
