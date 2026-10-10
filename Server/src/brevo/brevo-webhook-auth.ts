import type { Request, Response, NextFunction } from 'express';
import { loggedPath } from '../utils/api/request-context.js';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { safeEqual } from '../utils/security/safe-equal.js';

function extractSecret(header: string | undefined): string | null {
  if (!header) return null;
  const [ scheme, value ] = header.split(' ', 2);
  if (!scheme || !value) return null;

  if (scheme.toLowerCase() === 'bearer') return value.trim();

  if (scheme.toLowerCase() === 'basic') {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    return sep === -1 ? null : decoded.slice(sep + 1);
  }

  return null;
}

export function brevoWebhookAuth(req: Request, res: Response, next: NextFunction): void {
  if (config.skipWebhookAuth) {
    logger.warn('Brevo webhook authentication SKIPPED (SKIP_WEBHOOK_AUTH)');
    return next();
  }

  const secret = extractSecret(req.headers.authorization);

  if (!secret) {
    logger.warn({ url: loggedPath(req) }, 'Missing Brevo webhook credentials');
    res.status(403).send('Forbidden');
    return;
  }

  if (!safeEqual(secret, config.brevo.webhookSecret)) {
    logger.warn({ url: loggedPath(req) }, 'Invalid Brevo webhook credentials — request rejected');
    res.status(403).send('Forbidden');
    return;
  }

  next();
}
