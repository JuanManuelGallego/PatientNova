import type { CookieOptions } from 'express';
import { config } from '../utils/config/config.js';

export const PORTAL_COOKIE_NAME = 'portal_session';
export const PORTAL_COOKIE_PATH = '/v1/portal';

export function portalCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: PORTAL_COOKIE_PATH,
    maxAge: maxAgeMs,
    ...(config.cookieDomain && { domain: config.cookieDomain }),
  };
}
