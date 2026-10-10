import type { NextFunction, Request, Response } from 'express';
import { apiError } from '../utils/api/api-utils.js';
import { CSRF_HEADER, verifyCsrfToken } from '../utils/security/csrf.js';

const SAFE_METHODS = new Set([ 'GET', 'HEAD', 'OPTIONS' ]);

/**
 * Requires a valid `X-CSRF-Token` on every non-GET request of a cookie session.
 * `sessionIdFrom` resolves the already-authenticated session id (e.g. the JWT `jti`) and
 * `secret` is the portal secret. Not applied to the login-completing `otp/verify` route,
 * which has no session yet (its one-time code plus the exact Origin check cover login CSRF).
 */
export function requireCsrf(options: {
  sessionIdFrom: (req: Request) => string | undefined;
  secret: () => string;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const sessionId = options.sessionIdFrom(req);
    if (!sessionId || !verifyCsrfToken(sessionId, req.get(CSRF_HEADER), options.secret())) {
      apiError(res, 'Invalid CSRF token', 403);
      return;
    }
    next();
  };
}
