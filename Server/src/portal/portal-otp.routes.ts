import { Router, type Request, type Response } from 'express';
import { FIFTEEN_MINUTES_MS } from '../utils/config/constants.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { validateBody } from '../middlewares/validate.js';
import { createPublicLimiter } from '../middlewares/public-rate-limit.js';
import { requireCaptcha } from '../middlewares/captcha.js';
import { createCaptchaVerifier } from '../captcha/captcha-verifier.js';
import { PORTAL_COOKIE_NAME, portalCookieOptions } from '../auth/portal-cookie.js';
import { PORTAL_SESSION_TTL_SECONDS } from '../auth/tokens.js';
import { portalOtpService } from './portal-otp.service.js';
import { requestOtpSchema, verifyOtpSchema, type RequestOtpBody, type VerifyOtpBody } from './portal-otp.schemas.js';

export const OTP_CAPTCHA_ACTION = 'otp-request';

/**
 * Anonymous class (mounted under /v1/public/providers by createPublicApiRouter).
 * POST /:slug/otp — always 202 `{ challenge }` for a valid request, whatever happened (see
 * portalOtpService.request). The Portal keeps the latest challenge in memory and sends it to verify.
 * The per-IP limiter is only a coarse throttle; the real limits live on the PortalOtp row.
 */
export function createOtpRequestRouter(): Router {
  const router = Router();
  router.post(
    '/:slug/otp',
    createPublicLimiter({ name: 'otp-request-ip', windowMs: FIFTEEN_MINUTES_MS, max: 10 }),
    validateBody(requestOtpSchema),
    requireCaptcha(createCaptchaVerifier(), OTP_CAPTCHA_ACTION),
    asyncHandler(async (req: Request, res: Response) => {
      const { email } = req.body as RequestOtpBody;
      const result = await portalOtpService.request(String(req.params.slug), email);
      res.set('Cache-Control', 'no-store');
      ok(res, result, 202);
    }),
  );
  return router;
}

/**
 * Credentialed session class (mounted under /v1/portal by createPortalSessionRouter).
 * POST /:slug/otp/verify — exact Origin (router-wide), no CSRF header (this request creates the
 * session and returns its first CSRF token), no CAPTCHA (the attempt counter covers guessing).
 */
export function createOtpVerifyRouter(): Router {
  const router = Router();
  router.post(
    '/:slug/otp/verify',
    createPublicLimiter({ name: 'otp-verify-ip', windowMs: FIFTEEN_MINUTES_MS, max: 20 }),
    validateBody(verifyOtpSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { email, code, challenge } = req.body as VerifyOtpBody;
      const login = await portalOtpService.verify(String(req.params.slug), email, code, challenge);
      res.cookie(PORTAL_COOKIE_NAME, login.token, portalCookieOptions(PORTAL_SESSION_TTL_SECONDS * 1000));
      res.set('Cache-Control', 'no-store');
      ok(res, { email: login.email, expiresAt: login.expiresAt.toISOString(), csrfToken: login.csrfToken });
    }),
  );
  return router;
}
