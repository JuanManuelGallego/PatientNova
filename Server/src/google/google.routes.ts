import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { apiError, ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { authenticate, requireAdmin } from '../middlewares/authenticate.js';
import { logger } from '../utils/api/logger.js';
import { config } from '../utils/config/config.js';
import { googleOAuthService } from './google-oauth.service.js';
import { googleMeetService } from './google-meet.service.js';
import { GoogleOAuthError } from './google-errors.js';

export const googleRouter = Router();

const meetCreateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => { apiError(res, 'Too many Google Meet requests', 429); },
});

const OAUTH_ERROR_REDIRECTS: Record<string, string> = {
  INVALID_OAUTH_STATE: 'invalid_state',
  OAUTH_STATE_CONSUMED: 'state_consumed',
  GOOGLE_TOKEN_REVOKED: 'token_revoked',
  GOOGLE_SCOPE_MISSING: 'scope_missing',
  GOOGLE_CONFIG_MISSING: 'config_missing',
};

const validateOrigin = (req: Request): void => {
  const origin = req.headers.origin;
  if (!origin || typeof origin !== 'string' || !config.allowedOrigins.includes(origin)) {
    throw new GoogleOAuthError('Invalid origin', 'INVALID_ORIGIN', 403);
  }
};

googleRouter.get('/connection', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const status = await googleOAuthService.getConnectionStatus(req.user!.id);
  ok(res, status);
}));

googleRouter.post('/oauth/start', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  validateOrigin(req);
  const { returnPath = '/appointments', isReconnect = false } = req.body ?? {};
  const { authUrl } = await googleOAuthService.generateAuthUrl(req.user!.id, returnPath, isReconnect);
  ok(res, { authUrl });
}));

googleRouter.get('/oauth/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state, error: oauthError } = req.query;

  let completionUrl: URL;
  try {
    const portalUrl = config.portal?.url ?? 'http://localhost:3000';
    completionUrl = new URL('/google/oauth-complete', portalUrl);
  } catch {
    completionUrl = new URL('/google/oauth-complete', 'http://localhost:3000');
  }

  if (!state || typeof state !== 'string') {
    logger.warn('OAuth callback missing state');
    completionUrl.searchParams.set('success', 'false');
    completionUrl.searchParams.set('error', 'missing_parameters');
    return res.redirect(completionUrl.toString());
  }

  try {
    const result = await googleOAuthService.handleCallback(
      typeof code === 'string' ? code : undefined,
      state,
      Boolean(oauthError),
    );

    completionUrl.searchParams.set('success', 'true');
    completionUrl.searchParams.set('returnPath', result.returnPath);
    return res.redirect(completionUrl.toString());
  } catch (error) {
    logger.error({ errorCode: error instanceof GoogleOAuthError ? error.code : 'UNKNOWN' }, 'OAuth callback processing failed');

    completionUrl.searchParams.set('success', 'false');

    const mappedError = error instanceof GoogleOAuthError ? OAUTH_ERROR_REDIRECTS[error.code] : undefined;
    completionUrl.searchParams.set(
      'error',
      mappedError ?? (oauthError ? 'authorization_denied' : !code ? 'missing_parameters' : 'callback_failed'),
    );

    return res.redirect(completionUrl.toString());
  }
}));

googleRouter.delete('/connection', authenticate, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  validateOrigin(req);
  await googleOAuthService.disconnect(req.user!.id);
  ok(res, { success: true });
}));

googleRouter.post('/meet', authenticate, requireAdmin, meetCreateLimit, asyncHandler(async (req: Request, res: Response) => {
  validateOrigin(req);
  const result = await googleMeetService.createMeetingSpace(req.user!.id);
  ok(res, result);
}));
