import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { apiError } from '../utils/api/api-utils.js';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { loggedPath } from '../utils/api/request-context.js';
import { PgRateLimitStore } from './pg-rate-limit-store.js';

interface PublicLimiterOptions {
  /** Unique name; namespaces the counters so limiters never share buckets. */
  name: string;
  windowMs?: number;
  max?: number;
  /** Defaults to the client IP. Use for per-email / per-provider limits (the key is hashed in storage). */
  keyGenerator?: (req: Request) => string;
}

/**
 * Rate limiter for public (unauthenticated or portal-session) endpoints, backed by Postgres so
 * limits are shared across instances. `trust proxy` is set to 1 in app.ts, so `req.ip` is the
 * client address as seen by the single trusted proxy hop in front of the API.
 */
export function createPublicLimiter(opts: PublicLimiterOptions) {
  return rateLimit({
    windowMs: opts.windowMs ?? config.publicRateLimit.windowMs,
    limit: opts.max ?? config.publicRateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    store: new PgRateLimitStore(`${opts.name}:`),
    keyGenerator: opts.keyGenerator ?? ((req) => ipKeyGenerator(req.ip ?? 'unknown')),
    handler: (req, res) => {
      logger.warn({ limiter: opts.name, url: loggedPath(req), method: req.method }, 'Public rate limit exceeded');
      apiError(res, 'Too many requests, please try again later.', 429);
    },
  });
}
