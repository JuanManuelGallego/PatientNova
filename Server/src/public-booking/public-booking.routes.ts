import { Router, type Request, type Response } from 'express';
import { publicBookingService } from './public-booking.service.js';
import { slotsQuerySchema, type SlotsQuery } from './public-booking.schemas.js';
import type { ProviderImageKind } from './public-booking.repository.js';
import { validateQuery } from '../middlewares/validate.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';

export const publicBookingRouter = Router();

/**
 * GET /providers/:slug
 * Public provider card: name, title, time zone, bookable types and in-person locations.
 */
publicBookingRouter.get(
  '/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await publicBookingService.getProfile(String(req.params.slug));
    res.set('Cache-Control', 'no-store');
    ok(res, profile);
  })
);

/**
 * GET /providers/:slug/slots?typeId=&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Bookable start times for one appointment type, at most 31 local days.
 */
publicBookingRouter.get(
  '/:slug/slots',
  validateQuery(slotsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const slots = await publicBookingService.getSlots(String(req.params.slug), req.query as unknown as SlotsQuery);
    res.set('Cache-Control', 'no-store');
    ok(res, slots);
  })
);

/**
 * GET /providers/:slug/avatar and /providers/:slug/logo
 * The stored image as bytes (PNG, JPEG or WebP only), loadable cross-origin by the Portal.
 */
function imageHandler(kind: ProviderImageKind) {
  return asyncHandler(async (req: Request, res: Response) => {
    const image = await publicBookingService.getImage(String(req.params.slug), kind);
    res.set({
      'Content-Type': image.contentType,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=300',
      // helmet defaults CORP to same-origin, which would block the <img> on the Portal's origin.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.send(image.bytes);
  });
}

publicBookingRouter.get('/:slug/avatar', imageHandler('avatar'));
publicBookingRouter.get('/:slug/logo', imageHandler('logo'));
