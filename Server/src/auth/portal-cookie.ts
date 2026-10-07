import type { CookieOptions } from 'express';
import { config } from '../utils/config/config.js';

export const PORTAL_COOKIE_NAME = 'portal_session';
export const PORTAL_COOKIE_PATH = '/v1/portal';

/**
 * Patient portal session cookie. Distinct name and path from provider cookies. The Portal and API
 * share a registrable domain (patientnova.net / api.patientnova.net), so SameSite=Lax is enough;
 * the exact-Origin check and CSRF header cover cross-site mutations either way.
 */
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
