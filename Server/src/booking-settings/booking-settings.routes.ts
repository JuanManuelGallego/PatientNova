import { Router, type Request, type Response } from 'express';
import { replaceAvailabilitySchema, updateBookingSettingsSchema } from './booking-settings.schemas.js';
import { bookingSettingsService } from './booking-settings.service.js';
import { validateBody } from '../middlewares/validate.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';

export const bookingSettingsRouter = Router();

/**
 * GET /booking/settings
 * The current provider's online-booking settings, public link and readiness checklist.
 */
bookingSettingsRouter.get(
  '/settings',
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await bookingSettingsService.getSettings(req.user!.id));
  })
);

/**
 * PATCH /booking/settings
 * Update slug, enable/disable and slot rules. Enabling requires every readiness check.
 */
bookingSettingsRouter.patch(
  '/settings',
  validateBody(updateBookingSettingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await bookingSettingsService.updateSettings(req.user!.id, req.body));
  })
);

/**
 * GET /booking/slug-suggestion
 * A free slug derived from the provider's display name.
 */
bookingSettingsRouter.get(
  '/slug-suggestion',
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await bookingSettingsService.suggestSlug(req.user!.id));
  })
);

/**
 * GET /booking/availability
 * Weekly availability windows in the provider's timezone.
 */
bookingSettingsRouter.get(
  '/availability',
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await bookingSettingsService.getAvailability(req.user!.id));
  })
);

/**
 * PUT /booking/availability
 * Replace the whole weekly availability set atomically.
 */
bookingSettingsRouter.put(
  '/availability',
  validateBody(replaceAvailabilitySchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await bookingSettingsService.replaceAvailability(req.user!.id, req.body));
  })
);
