import type { NextFunction, Request, Response } from 'express';
import { apiError } from '../utils/api/api-utils.js';
import { logger } from '../utils/api/logger.js';

/** Integration point for a CAPTCHA provider (Turnstile, hCaptcha, reCAPTCHA...). */
export interface CaptchaVerifier {
  verify(token: string | undefined, ip: string | undefined): Promise<boolean>;
}

/** Placeholder used until a provider is chosen: accepts everything. Must be replaced before launch. */
export const noopCaptchaVerifier: CaptchaVerifier = {
  verify: async () => true,
};

/** Rejects the request unless the verifier accepts the `captchaToken` body field. */
export function requireCaptcha(verifier: CaptchaVerifier) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = typeof req.body?.captchaToken === 'string' ? req.body.captchaToken : undefined;
      if (!(await verifier.verify(token, req.ip))) {
        apiError(res, 'CAPTCHA verification failed', 400);
        return;
      }
      next();
    } catch (err) {
      logger.error({ err }, 'CAPTCHA verifier error');
      apiError(res, 'CAPTCHA verification failed', 400);
    }
  };
}
