import { type Response } from 'express';

import { ApiError } from '../errors/errors.js';
import { AppointmentOverlapError } from '../../appointments/appointment.errors.js';
import { isAppointmentOverlapViolation } from '../errors/prisma-errors.js';
import { logger } from './logger.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
  timestamp: string;
}

export function handleError(res: Response, err: unknown) {
  if (err instanceof ApiError) {
    return apiError(res, err.message, err.errorCode);
  }
  if (isAppointmentOverlapViolation(err)) {
    return apiError(res, new AppointmentOverlapError().message, 409);
  }
  // Never echo internal error text to clients, in any environment.
  logger.error({ err, requestId: res.locals?.requestId }, 'Unhandled route error');
  return apiError(res, 'Internal server error', 500);
}

export function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json(apiSuccessResponse(data));
}

export function apiError(res: Response, message: string, status = 400) {
  res.status(status).json(apiErrorResponse(message, res.locals?.requestId));
}

export function apiErrorResponse(error: string, requestId?: string): ApiResponse {
  return { success: false, error, ...(requestId && { requestId }), timestamp: new Date().toISOString() };
}

export function apiSuccessResponse<T>(data: T): ApiResponse {
  return { success: true, data, timestamp: new Date().toISOString() };
}