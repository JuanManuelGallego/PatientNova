import { createHmac } from 'node:crypto';
import { safeEqual } from './safe-equal.js';

/**
 * Stateless CSRF token for cookie-authenticated portal requests: an HMAC bound to the
 * session id. The Portal origin cannot read the API-domain cookie, so the token is returned
 * in a response body, kept in memory and sent back as `X-CSRF-Token`; the server recomputes
 * it from the session it just authenticated.
 */
export const CSRF_HEADER = 'x-csrf-token';

export function createCsrfToken(sessionId: string, secret: string): string {
  return createHmac('sha256', secret).update(`csrf:${sessionId}`).digest('base64url');
}

export function verifyCsrfToken(sessionId: string, token: string | undefined, secret: string): boolean {
  if (!token) return false;
  return safeEqual(createCsrfToken(sessionId, secret), token);
}
