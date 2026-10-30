import type { NextFunction, Request, Response } from 'express';
import { apiError } from '../utils/api/api-utils.js';
import { config } from '../utils/config/config.js';

/** Hides provider-side portal configuration routes unless ENABLE_PORTAL is on (same 404 as an unknown route). */
export function requirePortalEnabled(_req: Request, res: Response, next: NextFunction): void {
  if (!config.portal.patientEnabled) {
    apiError(res, 'Route not found', 404);
    return;
  }
  next();
}
