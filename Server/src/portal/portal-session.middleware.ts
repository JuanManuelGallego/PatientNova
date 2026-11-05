import type { NextFunction, Request, Response } from 'express';
import { PORTAL_COOKIE_NAME } from '../auth/portal-cookie.js';
import { portalSecret, verifyPortalToken } from '../auth/tokens.js';
import { apiError } from '../utils/api/api-utils.js';
import { logger } from '../utils/api/logger.js';
import { requireCsrf } from '../middlewares/csrf.js';
import { bookingSettingsService } from '../booking-settings/booking-settings.service.js';
import { contactFromClaims, type PortalContact } from './portal-contact.js';

export interface PortalSessionContext {
  userId: string;
  contact: PortalContact;
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
  userId: string;
  contact: PortalContact;
  sid: string;
  exp: number;
}

function readPortalClaims(payload: unknown): PortalClaims | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const contact = contactFromClaims(p);
  const valid = p.typ === 'portal'
    && typeof p.userId === 'string' && p.userId.length > 0
    && typeof p.sid === 'string' && p.sid.length > 0
    && typeof p.exp === 'number';
  return valid && contact ? { userId: p.userId as string, contact, sid: p.sid as string, exp: p.exp as number } : null;
}

const deny = (res: Response) => apiError(res, 'Invalid session', 401);

export async function requirePortalSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token: unknown = req.cookies?.[PORTAL_COOKIE_NAME];
  if (typeof token !== 'string' || token.length === 0) return deny(res);

  let claims: PortalClaims | null;
  try {
    claims = readPortalClaims(verifyPortalToken(token));
  } catch {
    return deny(res);
  }
  if (!claims) return deny(res);

  if (!(await bookingSettingsService.isPortalReachable(claims.userId))) {
    logger.info({ userId: claims.userId }, 'Portal session rejected: provider not reachable');
    return deny(res);
  }

  req.portal = {
    userId: claims.userId,
    contact: claims.contact,
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
