import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authService } from './auth.service.js';
import { loginSchema, changePasswordSchema } from './auth.schemas.js';
import { apiError, ok } from '../utils/api/api-utils.js';
import { FIFTEEN_MINUTES_MS, SEVEN_DAYS_MS } from '../utils/config/constants.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { logger } from '../utils/api/logger.js';
import {
  AuthInvalidCredentialsError,
  AuthAccountLockedError,
  AuthRefreshTokenExpiredError,
  AuthRefreshTokenRevokedError,
} from './auth.errors.js';

export const authRouter = Router();

/**
 * POST /auth/login
 * Public endpoint. Validates credentials and returns a JWT token + user info.
 * Enforces account lockout after repeated failed attempts.
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const dto = loginSchema.parse(req.body);
    const result = await authService.login(dto.email, dto.password, req.ip ?? '');
    const cookieDefaults = authService.getCookieDefaults();

    res.cookie('token', result.accessToken, {
      ...cookieDefaults,
      maxAge: FIFTEEN_MINUTES_MS,
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...cookieDefaults,
      path: '/v1/auth/refresh',
      maxAge: SEVEN_DAYS_MS,
    });

    ok(res, result.user);
  } catch (err) {
    if (err instanceof AuthInvalidCredentialsError) {
      return apiError(res, err.message, err.errorCode);
    }
    if (err instanceof AuthAccountLockedError) {
      return apiError(res, err.message, err.errorCode);
    }
    if (err instanceof z.ZodError) {
      return apiError(res, 'Invalid input', 400);
    }
    logger.error({ err }, 'Login failed');
    apiError(res, 'Login failed', 500);
  }
});

/**
 * POST /auth/logout
 * Public endpoint. Clears the auth and refresh cookies.
 */
authRouter.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    await authService.logout(req.user!.id);
    const cookieDefaults = authService.getCookieDefaults();
    res.clearCookie('token', cookieDefaults);
    res.clearCookie('refreshToken', { ...cookieDefaults, path: '/v1/auth/refresh' });
    ok(res, { message: 'Logged out' });
  } catch (err) {
    logger.error({ err, userId: req.user!.id }, 'Logout failed');
    return apiError(res, 'Logout failed', 500);
  }
});

/**
 * POST /auth/refresh
 * Public endpoint. Uses the refresh token cookie to issue a new access token.
 */
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return apiError(res, 'No refresh token', 401);

    const result = await authService.refreshToken(token);
    const cookieDefaults = authService.getCookieDefaults();

    res.cookie('token', result.accessToken, {
      ...cookieDefaults,
      maxAge: FIFTEEN_MINUTES_MS,
    });

    ok(res, { message: 'Token refreshed' });
  } catch (err) {
    if (err instanceof AuthRefreshTokenExpiredError) {
      return apiError(res, err.message, err.errorCode);
    }
    if (err instanceof AuthRefreshTokenRevokedError) {
      return apiError(res, err.message, err.errorCode);
    }
    logger.error({ err }, 'Token refresh failed');
    return apiError(res, 'Invalid refresh token', 401);
  }
});

/**
 * PATCH /auth/change-password
 * Requires authentication. Changes the user's password.
 */
authRouter.patch(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    ok(res, { message: 'Password changed successfully' });
  })
);
