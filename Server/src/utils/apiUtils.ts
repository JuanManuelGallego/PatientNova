import { type Response } from 'express';

import { ApiError } from './errors.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export function handleError(res: Response, err: unknown) {
  if (err instanceof ApiError) {
    return apiError(res, err.message, err.errorCode);
  }
  const msg = process.env.NODE_ENV === 'production' ? 'Internal server error' : String(err);
  return apiError(res, msg, 500);
}

export function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json(apiSuccessResponse(data));
}

export function apiError(res: Response, message: string, status = 400) {
  res.status(status).json(apiErrorResponse(message));
}

export function apiErrorResponse(error: string): ApiResponse {
  return { success: false, error, timestamp: new Date().toISOString() };
}

export function apiSuccessResponse<T>(data: T): ApiResponse {
  return { success: true, data, timestamp: new Date().toISOString() };
}