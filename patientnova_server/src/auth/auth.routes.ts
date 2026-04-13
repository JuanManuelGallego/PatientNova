import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/prismaClient.js';
import { apiError, ok } from '../utils/apiUtils.js';
import { config } from '../utils/config.js';
import { authenticate } from '../middlewares/authenticate.js';
import { userInclude } from '../utils/types.js';

export const authRouter = Router();

// Precomputed dummy hash used to ensure constant-time response on login
// regardless of whether the email exists, preventing user enumeration via timing.
let _dummyHash: string | undefined;
async function getDummyHash(): Promise<string> {
  if (!_dummyHash) _dummyHash = await bcrypt.hash('__dummy_timing_sink__', config.auth.bcryptRounds);
  return _dummyHash;
}

function getCookieDefaults() {
  const isProduction = config.env === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'lax' : 'strict') as 'lax' | 'strict',
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  };
}

/**
 * POST /auth/login
 * Public endpoint. Validates credentials and returns a JWT token + user info.
 * Enforces account lockout after repeated failed attempts.
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return apiError(res, 'Email and password required', 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') {
      await bcrypt.compare(password, await getDummyHash()); // constant-time sink to prevent email enumeration
      return apiError(res, 'Invalid credentials', 401);
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return apiError(res, 'Account temporarily locked. Try again later.', 423);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      // Increment failed attempts and lock if threshold reached
      const failedAttempts = user.failedLoginAttempts + 1;
      const lockData: { failedLoginAttempts: number; lockedUntil?: Date } = { failedLoginAttempts: failedAttempts };
      if (failedAttempts >= config.lockout.maxFailedAttempts) {
        lockData.lockedUntil = new Date(Date.now() + config.lockout.lockoutDurationMs);
      }
      await prisma.user.update({ where: { id: user.id }, data: lockData });
      return apiError(res, 'Invalid credentials', 401);
    }

    // Reset failed attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: req.ip?.replace('::ffff:', '') ?? null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, timezone: user.timezone },
      config.auth.jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh', version: user.refreshTokenVersion },
      config.auth.jwtSecret,
      { expiresIn: '7d' }
    );

    const cookieDefaults = getCookieDefaults();

    res.cookie('token', accessToken, {
      ...cookieDefaults,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      ...cookieDefaults,
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    ok(res, await prisma.user.findUnique({ where: { id: user.id }, select: userInclude }));
  } catch {
    apiError(res, 'Login failed', 500);
  }
});

/**
 * POST /auth/logout
 * Public endpoint. Clears the auth and refresh cookies.
 */
authRouter.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    // Invalidate all outstanding refresh tokens for this user by bumping the version
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { refreshTokenVersion: { increment: 1 } },
    });
    const cookieDefaults = getCookieDefaults();
    res.clearCookie('token', cookieDefaults);
    res.clearCookie('refreshToken', { ...cookieDefaults, path: '/auth/refresh' });
    ok(res, { message: 'Logged out' });
  } catch (err) {
    console.error('[logout] Error during logout:', err);
    return res.status(500).json({ error: 'Logout failed' });
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

    const payload = jwt.verify(token, config.auth.jwtSecret);
    if (typeof payload !== 'object' || payload === null || (payload as any).type !== 'refresh') {
      return apiError(res, 'Invalid refresh token', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: (payload as any).id } });
    if (!user || user.status !== 'ACTIVE') return apiError(res, 'Invalid refresh token', 401);

    // Reject if the token version no longer matches (user has logged out)
    if ((payload as any).version !== user.refreshTokenVersion) {
      return apiError(res, 'Refresh token has been revoked', 401);
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, timezone: user.timezone },
      config.auth.jwtSecret,
      { expiresIn: '15m' }
    );

    res.cookie('token', accessToken, {
      ...getCookieDefaults(),
      maxAge: 15 * 60 * 1000,
    });

    ok(res, { message: 'Token refreshed' });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return apiError(res, 'Refresh token expired', 401);
    }
    return apiError(res, 'Invalid refresh token', 401);
  }
});


