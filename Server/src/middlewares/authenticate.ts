import type { Request, Response, NextFunction } from 'express';
import { loggedPath } from '../utils/api/request-context.js';
import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '../auth/tokens.js';
import { apiError } from '../utils/api/api-utils.js';
import { logger } from '../utils/api/logger.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { requireCsrf } from './csrf.js';
import { config } from '../utils/config/config.js';

export interface AuthPayload {
  id: string;
  email: string;
  role: string;
  /** IANA timezone string (e.g. "America/Bogota"). Defaults to "UTC" for legacy tokens. */
  timezone: string;
  /** Login session id (`sid` claim); binds the CSRF token of cookie sessions. */
  sessionId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
    typeof (payload as Record<string, unknown>).id === 'string' &&
    typeof (payload as Record<string, unknown>).email === 'string' &&
    typeof (payload as Record<string, unknown>).role === 'string'
  );
}


/**
 * Cookie sessions must send `X-CSRF-Token` on unsafe methods: the browser attaches the cookie
 * to cross-site requests on its own (SameSite=None). Bearer tokens are never ambient, so
 * those requests need no CSRF token.
 */
const providerCsrf = requireCsrf({
  sessionIdFrom: (req) => req.user?.sessionId,
  secret: () => config.auth.jwtSecret,
});

/**
 * Verifies the JWT from the Cookie or Authorization: Bearer <token> header.
 * Attaches the decoded payload to req.user.
 * Rejects with 401 if missing/invalid, and with 403 when a cookie session sends an
 * unsafe request without a valid CSRF token.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  let token = req.cookies?.token;
  const fromCookie = Boolean(token);

  if (!token) {
    const authHeader = req.headers[ 'authorization' ];
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[ 0 ]!.toLowerCase() === 'bearer') {
        token = parts[ 1 ];
      }
    }
  }

  if (!token) {
    logger.debug({ ip: req.ip, url: loggedPath(req), method: req.method }, 'Auth: no token provided');
    return apiError(res, 'Unauthorized', 401);
  }

  try {
    const payload = verifyAccessToken(token);
    if (!isAuthPayload(payload)) {
      return apiError(res, 'Invalid token payload', 401);
    }

    // Normalize: inject timezone with fallback for tokens issued before this field was added
    req.user = {
      id:       payload.id,
      email:    payload.email,
      role:     payload.role,
      timezone: typeof (payload as unknown as Record<string, unknown>).timezone === 'string' ? (payload as unknown as Record<string, unknown>).timezone as string : 'UTC',
      ...(typeof (payload as unknown as Record<string, unknown>).sid === 'string' && { sessionId: (payload as unknown as Record<string, unknown>).sid as string }),
    };

    const ip = req.ip?.replace('::ffff:', '');
    const proceed = () => runInAuditContext({
      actorId: payload.id,
      actorDisplayName: payload.email,
      ...(ip && { ipAddress: ip }),
      userId: payload.id,
    }, () => next());

    if (fromCookie) {
      providerCsrf(req, res, proceed);
      return;
    }
    proceed();
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
    logger.warn({ userId: req.user?.id, role: req.user?.role, method: req.method, url: loggedPath(req) }, 'Permission denied: requires SUPER_ADMIN');
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
    logger.warn({ userId: req.user?.id, role: req.user?.role, method: req.method, url: loggedPath(req) }, 'Permission denied: requires ADMIN');
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
      logger.warn({ userId: req.user?.id, role: req.user?.role, method: req.method, url: loggedPath(req) }, 'Permission denied: write operation requires ADMIN');
      apiError(res, 'Insufficient permissions', 403);
      return;
    }
  }
  next();
}
