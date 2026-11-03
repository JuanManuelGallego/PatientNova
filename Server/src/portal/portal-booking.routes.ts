import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { FIFTEEN_MINUTES_MS } from '../utils/config/constants.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.js';
import { slotRangeQuerySchema, type SlotRangeQuery } from '../public-booking/public-booking.schemas.js';
import { createPublicLimiter } from '../middlewares/public-rate-limit.js';
import { uuidParamSchema } from '../utils/validation/schemas.js';
import type { ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { portalSessionGuard } from './portal-session.middleware.js';
import { portalBookingService } from './portal-booking.service.js';
import { portalAppointmentService } from './portal-appointment.service.js';
import { portalRequestService } from './portal-request.service.js';
import {
  createPortalBookingSchema,
  reschedulePortalAppointmentSchema,
  type CreatePortalBookingBody,
  type ReschedulePortalAppointmentBody,
} from './portal-booking.schemas.js';

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
      const result = await portalBookingService.book(req.portal!, req.body as CreatePortalBookingBody, requestMeta(req));
      res.set('Cache-Control', 'no-store');
      // 202: approval mode accepted a request for the provider to review; 201: the appointment exists.
      ok(res, result, 'request' in result ? 202 : 201);
    }),
  );

  // A pending request has no appointment yet, so it is cancelled on its own route (same budget and guard).
  router.post(
    '/requests/:id/cancel',
    changeLimiter,
    ...portalSessionGuard,
    validateParams(uuidParamSchema),
    validateBody(cancelBodySchema),
    asyncHandler(async (req: Request, res: Response) => {
      await portalRequestService.cancel(req.portal!, req.params.id as string, requestMeta(req));
      res.set('Cache-Control', 'no-store');
      res.status(204).end();
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

  // Read-only, so outside the change budget; same guard (GET skips the CSRF check).
  router.get(
    '/appointments/:id/slots',
    ...portalSessionGuard,
    validateParams(uuidParamSchema),
    validateQuery(slotRangeQuerySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const slots = await portalAppointmentService.rescheduleSlots(
        req.portal!,
        req.params.id as string,
        req.query as unknown as SlotRangeQuery,
      );
      res.set('Cache-Control', 'no-store');
      ok(res, slots);
    }),
  );

  router.post(
    '/appointments/:id/reschedule',
    changeLimiter,
    ...portalSessionGuard,
    validateParams(uuidParamSchema),
    validateBody(reschedulePortalAppointmentSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const appointment = await portalAppointmentService.reschedule(
        req.portal!,
        req.params.id as string,
        req.body as ReschedulePortalAppointmentBody,
        requestMeta(req),
      );
      res.set('Cache-Control', 'no-store');
      ok(res, { appointment });
    }),
  );

  return router;
}
