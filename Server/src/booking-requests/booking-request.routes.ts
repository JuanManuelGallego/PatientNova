import { Router, type Request, type Response } from 'express';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.js';
import { uuidParamSchema } from '../utils/validation/schemas.js';
import { bookingRequestReviewService } from './booking-request-review.service.js';
import {
  approveBookingRequestSchema,
  listBookingRequestsQuerySchema,
  rejectBookingRequestSchema,
  type ApproveBookingRequestBody,
  type ListBookingRequestsQuery,
} from './booking-request.schemas.js';

/** Mounted with `authenticate`, `requirePortalEnabled` and `requireAdmin` (VIEWER gets 403); cookie writes need CSRF. */
export const bookingRequestRouter = Router();

/** GET /booking-requests/count — live PENDING requests, for the sidebar badge and the alert. */
bookingRequestRouter.get('/count', asyncHandler(async (req: Request, res: Response) => {
  ok(res, await bookingRequestReviewService.count(req.user!.id));
}));

/** GET /booking-requests — one inbox tab (pending / resolved / expired), optionally limited to a start range. */
bookingRequestRouter.get(
  '/',
  validateQuery(listBookingRequestsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await bookingRequestReviewService.list(req.user!.id, req.query as unknown as ListBookingRequestsQuery));
  }),
);

/** GET /booking-requests/:id — the request plus the patients sharing its email, computed now. */
bookingRequestRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await bookingRequestReviewService.detail(req.user!.id, req.params.id as string));
  }),
);

bookingRequestRouter.post(
  '/:id/approve',
  validateParams(uuidParamSchema),
  validateBody(approveBookingRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await bookingRequestReviewService.approve(req.user!.id, req.params.id as string, req.body as ApproveBookingRequestBody));
  }),
);

bookingRequestRouter.post(
  '/:id/reject',
  validateParams(uuidParamSchema),
  validateBody(rejectBookingRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await bookingRequestReviewService.reject(req.user!.id, req.params.id as string));
  }),
);
