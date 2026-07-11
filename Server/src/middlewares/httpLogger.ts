import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Comprehensive HTTP request/response logger.
 * Logs request details (method, URL, query, params) at info level.
 * Body is logged at debug level to avoid leaking PII/PHI.
 * Response details (status, duration) are logged at info (or warn for 4xx+).
 */
export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  const requestLog: Record<string, unknown> = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip?.replace('::ffff:', ''),
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    params: Object.keys(req.params).length > 0 ? req.params : undefined,
  };

  logger.info(requestLog, 'REQUEST');

  if (req.body && Object.keys(req.body).length > 0) {
    logger.debug({ body: req.body }, 'REQUEST BODY');
  }

  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const duration = Date.now() - start;

    const responseLog: Record<string, unknown> = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
    };

    if (res.statusCode >= 400) {
      logger.warn(responseLog, 'RESPONSE');
    } else {
      logger.info(responseLog, 'RESPONSE');
    }

    return originalEnd.apply(this, args as any);
  } as any;

  next();
}
