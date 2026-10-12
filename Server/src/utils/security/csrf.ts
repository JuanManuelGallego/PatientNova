import { createHmac } from 'node:crypto';
import { safeEqual } from './safe-equal.js';

export const CSRF_HEADER = 'x-csrf-token';

export function createCsrfToken(sessionId: string, secret: string): string {
  return createHmac('sha256', secret).update(`csrf:${sessionId}`).digest('base64url');
}

export function verifyCsrfToken(sessionId: string, token: string | undefined, secret: string): boolean {
  if (!token) return false;
  return safeEqual(createCsrfToken(sessionId, secret), token);
}
