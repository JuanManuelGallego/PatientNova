import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { apiError } from '../utils/apiUtils.js';

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
    const errors = result.error.errors.map(
      (e) => `${e.path.join('.') || target}: ${e.message}`
    );
    apiError(res, errors.join('; '), 400);
    return;
  }

  // Write coerced/defaulted values back onto the request
  (req as any)[ target ] = result.data;
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
