import { Router, type Request, type Response } from 'express';
import { FIFTEEN_MINUTES_MS } from '../utils/config/constants.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { validateBody } from '../middlewares/validate.js';
import { createPublicLimiter } from '../middlewares/public-rate-limit.js';
import { requireCaptcha } from '../middlewares/captcha.js';
import { createCaptchaVerifier } from '../captcha/captcha-verifier.js';
import { requestMeta } from '../utils/api/request-meta.js';
import { bookingStartService } from './booking-start.service.js';
import {
  releaseBookingSchema,
  startBookingSchema,
  type ReleaseBookingBody,
  type StartBookingBody,
} from './portal-booking.schemas.js';

export const BOOKING_CAPTCHA_ACTION = 'booking';

export function createBookingConfirmationRoutes(): Router {
  const router = Router();

  router.post(
    '/providers/:slug/bookings',
    createPublicLimiter({ name: 'portal-booking-ip', windowMs: FIFTEEN_MINUTES_MS, max: 10 }),
    validateBody(startBookingSchema),
    requireCaptcha(createCaptchaVerifier(), BOOKING_CAPTCHA_ACTION),
    asyncHandler(async (req: Request, res: Response) => {
      const dto = await bookingStartService.start(String(req.params.slug), req.body as StartBookingBody, requestMeta(req));
      res.set('Cache-Control', 'no-store');
      ok(res, dto, 202);
    }),
  );

  const confirmLimiter = createPublicLimiter({ name: 'booking-confirm-ip', windowMs: FIFTEEN_MINUTES_MS, max: 20 });

  router.post(
    '/booking-confirmations/release',
    confirmLimiter,
    validateBody(releaseBookingSchema),
    asyncHandler(async (req: Request, res: Response) => {
      await bookingStartService.release((req.body as ReleaseBookingBody).releaseToken, requestMeta(req));
      res.set('Cache-Control', 'no-store');
      res.status(204).end();
    }),
  );

  return router;
}
