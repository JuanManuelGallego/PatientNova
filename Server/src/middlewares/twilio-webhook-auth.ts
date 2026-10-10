import type { Request, Response, NextFunction } from 'express';
import { loggedPath } from '../utils/api/request-context.js';
import twilio from 'twilio';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';

/**
 * Validates that an incoming POST request was genuinely sent by Twilio.
 *
 * Twilio signs every webhook request using HMAC-SHA1 over the full URL + sorted
 * POST parameters. The resulting signature is sent in the `X-Twilio-Signature`
 * header. We reproduce that signature locally and compare.
 *
 * Validation is skipped only when NODE_ENV=development AND SKIP_WEBHOOK_AUTH=true, so you can
 * test with curl / Postman without a real ngrok tunnel. Never set either in production.
 */
export function twilioWebhookAuth(req: Request, res: Response, next: NextFunction): void {
  if (config.skipWebhookAuth) {
    logger.warn('Twilio webhook signature validation SKIPPED (SKIP_WEBHOOK_AUTH)');
    return next();
  }

  const signature = req.headers['x-twilio-signature'] as string | undefined;

  if (!signature) {
    logger.warn({ url: loggedPath(req) }, 'Missing X-Twilio-Signature on webhook request');
    res.status(403).send('Forbidden');
    return;
  }

  // Reconstruct the exact public URL Twilio posted to
  const fullUrl = `${config.twilio.webhookBaseUrl}${req.originalUrl}`;

  // req.body is already parsed as an object by express.urlencoded()
  const params = (req.body ?? {}) as Record<string, string>;

  const isValid = twilio.validateRequest(
    config.twilio.authToken,
    signature,
    fullUrl,
    params,
  );

  if (!isValid) {
    logger.warn({ url: fullUrl }, 'Invalid Twilio webhook signature — request rejected');
    res.status(403).send('Forbidden');
    return;
  }

  next();
}
