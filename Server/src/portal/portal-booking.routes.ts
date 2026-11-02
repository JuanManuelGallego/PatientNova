import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { FIFTEEN_MINUTES_MS } from '../utils/config/constants.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import { createPublicLimiter } from '../middlewares/public-rate-limit.js';
import { uuidParamSchema } from '../utils/validation/schemas.js';
import type { ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { portalSessionGuard } from './portal-session.middleware.js';
import { portalBookingService } from './portal-booking.service.js';
import { portalAppointmentService } from './portal-appointment.service.js';
import { createPortalBookingSchema, type CreatePortalBookingBody } from './portal-booking.schemas.js';

/** Cancel takes no input: no reason field, so no free text reaches the server. */
const cancelBodySchema = z.strictObject({}).optional();

const requestMeta = (req: Request): ConsentRequestMeta => ({
  ipAddress: req.ip?.replace('::ffff:', ''),
  userAgent: req.get('user-agent'),
});

export function createPortalBookingRoutes(): Router {
  const router = Router();
  // One budget for every change a patient makes to an existing appointment.
  const changeLimiter = createPublicLimiter({ name: 'portal-change-ip', windowMs: FIFTEEN_MINUTES_MS, max: 10 });

  router.post(
    '/bookings',
    createPublicLimiter({ name: 'portal-booking-ip', windowMs: FIFTEEN_MINUTES_MS, max: 10 }),
    ...portalSessionGuard,
    validateBody(createPortalBookingSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const appointment = await portalBookingService.book(req.portal!, req.body as CreatePortalBookingBody, requestMeta(req));
      res.set('Cache-Control', 'no-store');
      ok(res, { appointment }, 201);
    }),
  );

  router.get('/appointments', ...portalSessionGuard, asyncHandler(async (req: Request, res: Response) => {
    const view = await portalBookingService.listAppointments(req.portal!);
    res.set('Cache-Control', 'no-store');
    ok(res, view);
  }));

  router.post(
    '/appointments/:id/cancel',
    changeLimiter,
    ...portalSessionGuard,
    validateParams(uuidParamSchema),
    validateBody(cancelBodySchema),
    asyncHandler(async (req: Request, res: Response) => {
      await portalAppointmentService.cancel(req.portal!, req.params.id as string, requestMeta(req));
      res.set('Cache-Control', 'no-store');
      res.status(204).end();
    }),
  );

  return router;
}
