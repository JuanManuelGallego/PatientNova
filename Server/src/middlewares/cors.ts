import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { apiError } from '../utils/api/api-utils.js';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { CorsRejectionError } from './error-handler.js';

function allowListOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void {
  // No Origin header = not a browser cross-origin request (curl, server-to-server): allow.
  if (!origin || config.allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  logger.warn({ origin }, 'CORS rejection');
  callback(new CorsRejectionError());
}

/** Provider (admin) API: credentialed, exact allow-list. */
export const providerCors = cors({ origin: allowListOrigin, credentials: true });

/**
 * Anonymous public API class: no cookies are ever read or set, so credentials stay OFF
 * (no Access-Control-Allow-Credentials) and clients must use `credentials: 'omit'`.
 */
export const anonymousCors = cors({
  origin: allowListOrigin,
  credentials: false,
  methods: [ 'GET', 'POST', 'OPTIONS' ],
  allowedHeaders: [ 'Content-Type' ],
  maxAge: 600,
});

/** Credentialed patient-session class: exact-origin allow-list, cookies + CSRF header allowed. */
export const sessionCors = cors({
  origin: allowListOrigin,
  credentials: true,
  methods: [ 'GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS' ],
  allowedHeaders: [ 'Content-Type', 'X-CSRF-Token' ],
  maxAge: 600,
});

const SAFE_METHODS = new Set([ 'GET', 'HEAD', 'OPTIONS' ]);

/**
 * Cookie-authenticated mutations must come from an allow-listed browser origin: the Origin
 * header has to be present AND exactly match. (CORS alone does not stop a cross-site form POST.)
 */
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
