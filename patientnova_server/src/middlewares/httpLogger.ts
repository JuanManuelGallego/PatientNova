import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Comprehensive HTTP request/response logger.
 * Logs full request details (method, URL, query, params, body, user) and
 * response details (status, duration) at info level.
 */
export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  const requestLog: Record<string, unknown> = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip?.replace('::ffff:', ''),
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    params: Object.keys(req.params).length > 0 ? req.params : undefined,
    body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
  };

  logger.info(requestLog, 'REQUEST');

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
