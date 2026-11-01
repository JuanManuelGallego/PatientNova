import { Router, type Request, type Response } from 'express';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { validateBody } from '../middlewares/validate.js';
import { PORTAL_COOKIE_NAME, portalClearCookieOptions } from '../auth/portal-cookie.js';
import { portalSessionGuard } from './portal-session.middleware.js';
import { portalSessionService } from './portal-session.service.js';
import { acceptConsentSchema } from './portal-session.schemas.js';

/** Routes for an authenticated patient session. Every route goes behind `portalSessionGuard`. */
export function createPortalSessionRoutes(): Router {
  const router = Router();

  router.get('/session', ...portalSessionGuard, asyncHandler(async (req: Request, res: Response) => {
    const view = await portalSessionService.getSession(req.portal!);
    res.set('Cache-Control', 'no-store');
    ok(res, view);
  }));

  router.post('/consent', ...portalSessionGuard, validateBody(acceptConsentSchema), asyncHandler(async (req: Request, res: Response) => {
    await portalSessionService.acceptConsent(req.portal!, {
      ipAddress: req.ip?.replace('::ffff:', ''),
      userAgent: req.get('user-agent'),
    });
    res.status(204).end();
  }));

  // No session guard: logout must clear the cookie even when the session no longer validates (e.g. the
  // provider is briefly not live), or it could revive later. The router's exact-Origin check covers CSRF.
  router.post('/logout', (_req: Request, res: Response) => {
    res.clearCookie(PORTAL_COOKIE_NAME, portalClearCookieOptions());
    res.set('Cache-Control', 'no-store');
    res.status(204).end();
  });

  return router;
}
