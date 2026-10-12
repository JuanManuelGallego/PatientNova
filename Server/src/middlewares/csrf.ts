import type { NextFunction, Request, Response } from 'express';
import { apiError } from '../utils/api/api-utils.js';
import { CSRF_HEADER, verifyCsrfToken } from '../utils/security/csrf.js';

const SAFE_METHODS = new Set([ 'GET', 'HEAD', 'OPTIONS' ]);

/**
 * Requires a valid `X-CSRF-Token` on every request except GET/HEAD/OPTIONS.
 * `sessionIdFrom` resolves the already-authenticated session id (the provider JWT `sid` claim)
 * and `secret` is the HMAC key (`AUTH_SECRET`). The 403 message is matched exactly by the
 * Portal's `isCsrfRejection` to trigger a token refetch; keep them in sync.
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
