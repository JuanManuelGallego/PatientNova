import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { apiError } from '../utils/api/api-utils.js';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { CorsRejectionError } from './error-handler.js';

function allowListOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void {
  if (!origin || config.allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  logger.warn({ origin }, 'CORS rejection');
  callback(new CorsRejectionError());
}

export const providerCors = cors({ origin: allowListOrigin, credentials: true });

export const anonymousCors = cors({
  origin: allowListOrigin,
  credentials: false,
  methods: [ 'GET', 'POST', 'OPTIONS' ],
  allowedHeaders: [ 'Content-Type' ],
  maxAge: 600,
});

export const sessionCors = cors({
  origin: allowListOrigin,
  credentials: true,
  methods: [ 'GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS' ],
  allowedHeaders: [ 'Content-Type', 'X-CSRF-Token' ],
  maxAge: 600,
});

const SAFE_METHODS = new Set([ 'GET', 'HEAD', 'OPTIONS' ]);

export function requireExactOrigin(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const origin = req.get('origin');
  if (!origin || !config.allowedOrigins.includes(origin)) {
    logger.warn({ origin, method: req.method }, 'Rejected state-changing request with missing/unknown Origin');
    apiError(res, 'Origin not allowed', 403);
    return;
  }
  next();
}
