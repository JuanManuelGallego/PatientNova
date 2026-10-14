import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { apiError } from '../utils/api/api-utils.js';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { loggedPath } from '../utils/api/request-context.js';

interface PublicLimiterOptions {
  name: string;
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
}

export function createPublicLimiter(opts: PublicLimiterOptions) {
  return rateLimit({
    windowMs: opts.windowMs ?? config.publicRateLimit.windowMs,
    limit: opts.max ?? config.publicRateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: opts.keyGenerator ?? ((req) => ipKeyGenerator(req.ip ?? 'unknown')),
    handler: (req, res) => {
      logger.warn({ limiter: opts.name, url: loggedPath(req), method: req.method }, 'Public rate limit exceeded');
      apiError(res, 'Too many requests, please try again later.', 429);
    },
  });
}
