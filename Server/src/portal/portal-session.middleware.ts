import type { NextFunction, Request, Response } from 'express';
import { PORTAL_COOKIE_NAME } from '../auth/portal-cookie.js';
import { portalSecret, verifyPortalToken } from '../auth/tokens.js';
import { apiError } from '../utils/api/api-utils.js';
import { logger } from '../utils/api/logger.js';
import { requireCsrf } from '../middlewares/csrf.js';
import { bookingSettingsService } from '../booking-settings/booking-settings.service.js';

export interface PortalSessionContext {
  userId: string;
  email: string;
  sid: string;
  expiresAt: Date;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      portal?: PortalSessionContext;
    }
  }
}

interface PortalClaims {
  typ: 'portal';
  userId: string;
  email: string;
  sid: string;
  exp: number;
}

function isPortalClaims(payload: unknown): payload is PortalClaims {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return p.typ === 'portal'
    && typeof p.userId === 'string' && p.userId.length > 0
    && typeof p.email === 'string' && p.email.length > 0
    && typeof p.sid === 'string' && p.sid.length > 0
    && typeof p.exp === 'number';
}

const deny = (res: Response) => apiError(res, 'Invalid session', 401);

/**
 * Authenticates the patient portal session cookie and sets `req.portal`. Every failure (missing,
 * tampered, expired, provider token, provider no longer live) is the same 401. Mount it on every
 * session route, followed by `requirePortalCsrf`; scope every query by `req.portal`, never by
 * client-supplied ids.
 */
export async function requirePortalSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token: unknown = req.cookies?.[PORTAL_COOKIE_NAME];
  if (typeof token !== 'string' || token.length === 0) return deny(res);

  let claims: unknown;
  try {
    claims = verifyPortalToken(token);
  } catch {
    return deny(res);
  }
  if (!isPortalClaims(claims)) return deny(res);

  if (!(await bookingSettingsService.isBookingLive(claims.userId))) {
    logger.info({ userId: claims.userId }, 'Portal session rejected: provider not live');
    return deny(res);
  }

  req.portal = {
    userId: claims.userId,
    email: claims.email,
    sid: claims.sid,
    expiresAt: new Date(claims.exp * 1000),
  };
  next();
}

export const requirePortalCsrf = requireCsrf({
  sessionIdFrom: (req) => req.portal?.sid,
  secret: portalSecret,
});

export const portalSessionGuard = [ requirePortalSession, requirePortalCsrf ] as const;
