import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { apiError } from '../utils/apiUtils.js';
import { logger } from '../utils/logger.js';

type Target = 'body' | 'query' | 'params';

function makeValidator<T extends z.ZodTypeAny>(
  schema: T,
  target: Target,
  req: Request<any, any, any, any>,
  res: Response,
  next: NextFunction
) {
  const result = schema.safeParse(req[ target ]);

  if (!result.success) {
    const errors = result.error.issues.map(
      (e) => `${e.path.join('.') || target}: ${e.message}`
    );
    logger.debug({ method: req.method, url: req.originalUrl, target, errors: errors.join('; ') }, 'VALIDATION FAILED');
    apiError(res, errors.join('; '), 400);
    return;
  }

  logger.debug({ method: req.method, url: req.originalUrl, target }, 'VALIDATION OK');

  // Write coerced/defaulted values back onto the request
  Object.defineProperty(req, target, {
    value: result.data,
    writable: true,
    configurable: true,
  });
  next();
}

export const validateBody = <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request<any, any, z.infer<T>, any>, res: Response, next: NextFunction): void =>
    makeValidator(schema, 'body', req, res, next);

export const validateQuery = <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request<any, any, any, z.infer<T>>, res: Response, next: NextFunction): void =>
    makeValidator(schema, 'query', req, res, next);

export const validateParams = <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request<z.infer<T>, any, any, any>, res: Response, next: NextFunction): void =>
    makeValidator(schema, 'params', req, res, next);
