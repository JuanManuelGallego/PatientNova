import type { NextFunction, Request, Response } from 'express';
import { apiError } from '../utils/api/api-utils.js';
import { logger } from '../utils/api/logger.js';
import { loggedPath } from '../utils/api/request-context.js';
import type { CaptchaVerifier } from '../captcha/captcha-verifier.js';

/**
 * Requires a solved CAPTCHA (`captchaToken` in the JSON body) bound to `action`.
 * Mount after the rate limiter (so floods never reach the provider) and the body parser.
 * Fails closed: a provider outage answers 503 rather than letting the request through.
 */
export function requireCaptcha(verifier: CaptchaVerifier, action: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = typeof req.body?.captchaToken === 'string' ? req.body.captchaToken : undefined;
      const result = await verifier.verify({ token, ip: req.ip, action });
      if (result.ok) {
        next();
        return;
      }
      logger.warn({ reason: result.reason, action, url: loggedPath(req) }, 'CAPTCHA verification failed');
      if (result.reason === 'unavailable') {
        apiError(res, 'CAPTCHA verification is temporarily unavailable, please try again.', 503);
        return;
      }
      apiError(res, 'CAPTCHA verification failed', 400);
    } catch (err) {
      logger.error({ err, action }, 'CAPTCHA verifier error');
      apiError(res, 'CAPTCHA verification is temporarily unavailable, please try again.', 503);
    }
  };
}
