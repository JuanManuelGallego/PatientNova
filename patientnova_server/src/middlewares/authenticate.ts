import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../utils/config.js';
import { apiError } from '../utils/apiUtils.js';
import { logger } from '../utils/logger.js';

export interface AuthPayload {
  id: string;
  email: string;
  role: string;
  /** IANA timezone string (e.g. "America/Bogota"). Defaults to "UTC" for legacy tokens. */
  timezone: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

function isAuthPayload(payload: unknown): payload is AuthPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as any).id === 'string' &&
    typeof (payload as any).email === 'string' &&
    typeof (payload as any).role === 'string'
  );
}


/**
 * Verifies the JWT from the Cookie or Authorization: Bearer <token> header.
 * Attaches the decoded payload to req.user.
 * Rejects with 401 if missing/invalid.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers[ 'authorization' ];
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[ 0 ]!.toLowerCase() === 'bearer') {
        token = parts[ 1 ];
      }
    }
  }

  if (!token) return apiError(res, 'Unauthorized', 401);

  try {
    const payload = jwt.verify(token, config.auth.jwtSecret);
    if (!isAuthPayload(payload)) {
      return apiError(res, 'Invalid token payload', 401);
    }

    // Normalize: inject timezone with fallback for tokens issued before this field was added
    req.user = {
      id:       payload.id,
      email:    payload.email,
      role:     payload.role,
      timezone: typeof (payload as any).timezone === 'string' ? (payload as any).timezone : 'UTC',
    };
    next();
  } catch (err) {
    logger.warn({ err, ip: req.ip }, 'Auth failure');
    if (err instanceof jwt.TokenExpiredError) {
      return apiError(res, 'Token expired', 401);
    }
    return apiError(res, 'Invalid token', 401);
  }
}

/**
 * Requires SUPER_ADMIN role. Must be used after authenticate().
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'SUPER_ADMIN') {
    apiError(res, 'Insufficient permissions', 403);
    return;
  }
  next();
}

/**
 * Requires ADMIN or SUPER_ADMIN role. Must be used after authenticate().
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    apiError(res, 'Insufficient permissions', 403);
    return;
  }
  next();
}

/**
 * Requires ADMIN or SUPER_ADMIN for write operations (POST, PATCH, PUT, DELETE).
 * VIEWER role is allowed for GET/HEAD/OPTIONS only.
 * Must be used after authenticate().
 */
export function requireAdminForWrites(req: Request, res: Response, next: NextFunction): void {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    if (!req.user || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      apiError(res, 'Insufficient permissions', 403);
      return;
    }
  }
  next();
}
