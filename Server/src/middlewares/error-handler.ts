import type { NextFunction, Request, Response } from 'express';

import { loggedPath } from '../utils/api/request-context.js';
import { apiError } from '../utils/api/api-utils.js';
import { logger } from '../utils/api/logger.js';
import { ApiError } from '../utils/errors/errors.js';
import { AppointmentOverlapError } from '../appointments/appointment.errors.js';
import { isAppointmentOverlapViolation } from '../utils/errors/prisma-errors.js';

export class CorsRejectionError extends ApiError {
  constructor() {
    super('Origin not allowed', 403);
  }
}

interface HttpLikeError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ApiError) {
    apiError(res, err.message, err.errorCode);
    return;
  }

  if (isAppointmentOverlapViolation(err)) {
    apiError(res, new AppointmentOverlapError().message, 409);
    return;
  }

  const httpErr = err as HttpLikeError;

  if (httpErr?.type === 'entity.parse.failed') {
    apiError(res, 'Invalid JSON body', 400);
    return;
  }
  if (httpErr?.type === 'entity.too.large') {
    apiError(res, 'Request body too large', 413);
    return;
  }

  const status = httpErr?.status ?? httpErr?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    apiError(res, 'Bad request', status);
    return;
  }

  logger.error(
    { err, method: req.method, url: loggedPath(req), requestId: req.requestId },
    'Unhandled error',
  );
  apiError(res, 'Internal server error', 500);
}
