import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/api/logger.js';
import { loggedPath } from '../utils/api/request-context.js';

/**
 * Comprehensive HTTP request/response logger.
 * Logs request details (method, path) at info level. Query strings and params are never
 * logged (they can carry emails/search terms); the body is logged at debug level only and
 * is subject to the logger's PII redaction.
 * Response details (status, duration) are logged at info (or warn for 4xx+).
 */
export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  const requestLog: Record<string, unknown> = {
    requestId: req.requestId,
    method: req.method,
    url: loggedPath(req),
    ip: req.ip?.replace('::ffff:', ''),
  };

  logger.info(requestLog, 'REQUEST');

  if (req.body && Object.keys(req.body).length > 0) {
    logger.debug({ body: req.body }, 'REQUEST BODY');
  }

  const originalEnd = res.end;
  res.end = function (this: Response, ...args: unknown[]) {
    const duration = Date.now() - start;

    const responseLog: Record<string, unknown> = {
      requestId: req.requestId,
      method: req.method,
      url: loggedPath(req),
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
    };

    if (res.statusCode >= 400) {
      logger.warn(responseLog, 'RESPONSE');
    } else {
      logger.info(responseLog, 'RESPONSE');
    }

    return originalEnd.apply(this, args as Parameters<typeof originalEnd>);
  } as typeof res.end;

  next();
}
