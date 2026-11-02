import { Router, type Request, type Response } from 'express';
import { FIFTEEN_MINUTES_MS } from '../utils/config/constants.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { validateBody } from '../middlewares/validate.js';
import { createPublicLimiter } from '../middlewares/public-rate-limit.js';
import { portalSessionGuard } from './portal-session.middleware.js';
import { portalBookingService } from './portal-booking.service.js';
import { createPortalBookingSchema, type CreatePortalBookingBody } from './portal-booking.schemas.js';

export function createPortalBookingRoutes(): Router {
  const router = Router();

  router.post(
    '/bookings',
    createPublicLimiter({ name: 'portal-booking-ip', windowMs: FIFTEEN_MINUTES_MS, max: 10 }),
    ...portalSessionGuard,
    validateBody(createPortalBookingSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const appointment = await portalBookingService.book(req.portal!, req.body as CreatePortalBookingBody, {
        ipAddress: req.ip?.replace('::ffff:', ''),
        userAgent: req.get('user-agent'),
      });
      res.set('Cache-Control', 'no-store');
      ok(res, { appointment }, 201);
    }),
  );

  router.get('/appointments', ...portalSessionGuard, asyncHandler(async (req: Request, res: Response) => {
    const view = await portalBookingService.listAppointments(req.portal!);
    res.set('Cache-Control', 'no-store');
    ok(res, view);
  }));

  return router;
}
