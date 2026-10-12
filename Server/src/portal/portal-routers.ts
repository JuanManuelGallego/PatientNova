import express, { Router, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { anonymousCors, requireExactOrigin, sessionCors } from '../middlewares/cors.js';
import { createPublicLimiter } from '../middlewares/public-rate-limit.js';
import { apiError } from '../utils/api/api-utils.js';

export const PUBLIC_BODY_LIMIT = '10kb';

const routeNotFound = (_req: Request, res: Response) => apiError(res, 'Route not found', 404);

export function createPublicApiRouter(): Router {
  const router = Router();
  router.use(anonymousCors);
  router.use(express.json({ limit: PUBLIC_BODY_LIMIT }));
  router.use(createPublicLimiter({ name: 'public-ip' }));
  return router;
}

export function createPortalSessionRouter(): Router {
  const router = Router();
  router.use(sessionCors);
  router.use(requireExactOrigin);
  router.use(express.json({ limit: PUBLIC_BODY_LIMIT }));
  router.use(cookieParser());
  router.use(createPublicLimiter({ name: 'portal-ip' }));
  return router;
}

export const portalNotFound = routeNotFound;
