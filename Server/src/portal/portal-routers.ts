import express, { Router, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { anonymousCors, requireExactOrigin, sessionCors } from '../middlewares/cors.js';
import { createPublicLimiter } from '../middlewares/public-rate-limit.js';
import { apiError } from '../utils/api/api-utils.js';
import { publicBookingRouter } from '../public-booking/public-booking.routes.js';
import { createOtpRequestRouter, createOtpVerifyRouter } from './portal-otp.routes.js';
import { createPortalSessionRoutes } from './portal-session.routes.js';
import { createPortalBookingRoutes } from './portal-booking.routes.js';

export const PUBLIC_BODY_LIMIT = '10kb';

export function createPublicApiRouter(): Router {
  const router = Router();
  router.use(anonymousCors);
  router.use(createPublicLimiter({ name: 'public-ip' }));
  router.use(express.json({ limit: PUBLIC_BODY_LIMIT }));
  router.use('/providers', createOtpRequestRouter());
  router.use('/providers', publicBookingRouter);
  return router;
}

export function createPortalSessionRouter(): Router {
  const router = Router();
  router.use(sessionCors);
  router.use(requireExactOrigin);
  router.use(createPublicLimiter({ name: 'portal-ip' }));
  router.use(express.json({ limit: PUBLIC_BODY_LIMIT }));
  // Scoped here, not app-wide: the anonymous /v1/public class must never read cookies.
  router.use(cookieParser());
  router.use(createOtpVerifyRouter());
  router.use(createPortalSessionRoutes());
  router.use(createPortalBookingRoutes());
  return router;
}

export const portalNotFound = (_req: Request, res: Response) => apiError(res, 'Route not found', 404);
