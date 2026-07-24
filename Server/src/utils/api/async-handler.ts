import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import { handleError } from './api-utils.js';
import { logger } from './logger.js';

/**
 * Wraps an async route handler, forwarding any thrown errors to handleError.
 * Eliminates the need for repetitive try/catch in every route.
 */
export function asyncHandler<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
>(
  fn: (req: Request<P, ResBody, ReqBody, ReqQuery>, res: Response<ResBody>, next: NextFunction) => Promise<void>
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    fn(req as Request<P, ResBody, ReqBody, ReqQuery>, res as Response<ResBody>, next).catch((err: unknown) => {
      logger.error({ err, method: req.method, url: req.originalUrl, userId: (req as Request & { user?: { id?: string } }).user?.id }, 'Unhandled route error');
      handleError(res, err);
    });
  };
}
