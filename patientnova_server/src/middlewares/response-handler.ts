import { type Request, type Response, type NextFunction } from 'express';
import { apiSuccessResponse, apiErrorResponse } from '../utils/apiUtils.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

declare global {
  namespace Express {
    interface Response {
      success<T>(data: T, code?: number): Response;
      error(message: string, code?: number): Response;
    }
  }
}

export function responseHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.success = function <T>(data: T, code = 200): Response {
    return this.status(code).json(apiSuccessResponse(data));
  };

  res.error = function (message: string, code = 400): Response {
    return this.status(code).json(apiErrorResponse(message));
  };

  next();
}
