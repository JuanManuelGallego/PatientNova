import express, { Router, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { anonymousCors, requireExactOrigin, sessionCors } from '../middlewares/cors.js';
import { createPublicLimiter } from '../middlewares/public-rate-limit.js';
import { apiError } from '../utils/api/api-utils.js';

/** Public endpoints have tiny payloads; keep the body limit far below the provider API's. */
export const PUBLIC_BODY_LIMIT = '10kb';

const routeNotFound = (_req: Request, res: Response) => apiError(res, 'Route not found', 404);

/**
 * Anonymous class (`/v1/public/*`): provider catalog, slots, OTP request.
 * No cookie parsing, no credentials, own CORS, 10kb bodies, shared-store rate limit.
 */
export function createPublicApiRouter(): Router {
  const router = Router();
  router.use(anonymousCors);
  router.use(express.json({ limit: PUBLIC_BODY_LIMIT }));
  router.use(createPublicLimiter({ name: 'public-ip' }));
  return router;
}

/**
 * Credentialed patient-session class (`/v1/portal/*`). Exact-origin CORS with credentials,
 * mandatory Origin on mutations, cookies parsed, 10kb bodies. Routes that run after session
 * resolution must add `requireCsrf` (except `otp/verify`, which creates the session).
 */
export function createPortalSessionRouter(): Router {
  const router = Router();
  router.use(sessionCors);
  router.use(requireExactOrigin);
  router.use(express.json({ limit: PUBLIC_BODY_LIMIT }));
  router.use(cookieParser());
  router.use(createPublicLimiter({ name: 'portal-ip' }));
  return router;
}

/** Terminal handler so unmatched portal paths never fall through to the provider stack. */
export const portalNotFound = routeNotFound;
