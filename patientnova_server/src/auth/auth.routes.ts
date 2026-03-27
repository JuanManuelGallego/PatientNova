import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/prismaClient.js';
import { apiError, ok } from '../utils/apiUtils.js';
import { config } from '../utils/config.js';
import { authenticate, requireSuperAdmin } from '../middlewares/authenticate.js';
import { AdminRole } from '@prisma/client';

export const authRouter = Router();

function validatePasswordStrength(password: string): string[] {
  const errors = [];

  if (password.length < 8) errors.push("At least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("At least one uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("At least one lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("At least one number");
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push("At least one special character");

  return errors;
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
    if (!user || user.status !== 'ACTIVE') return apiError(res, 'Invalid credentials', 401);

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
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.auth.jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      config.auth.jwtSecret,
      { expiresIn: '7d' }
    );

    const isProduction = config.env === 'production';

    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    ok(res, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        jobTitle: user.jobTitle,
        role: user.role,
        status: user.status
      }
    });
  } catch {
    apiError(res, 'Login failed', 500);
  }
});

/**
 * POST /auth/logout
 * Public endpoint. Clears the auth and refresh cookies.
 */
authRouter.post('/logout', (_req: Request, res: Response) => {
  try {
    res.clearCookie('token');
    res.clearCookie('refreshToken', { path: '/auth/refresh' });
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

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.auth.jwtSecret,
      { expiresIn: '15m' }
    );

    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict',
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

/**
 * POST /auth/register
 * Protected (SUPER_ADMIN only). Creates a new user with a hashed password.
 */
authRouter.post('/register', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    if (!email || !password || !firstName) {
      apiError(res, 'Email, password, and firstName are required', 400);
      return;
    }

    const passwordErrors = validatePasswordStrength(password);
    if (passwordErrors.length > 0) {
      apiError(res, `Password does not meet strength requirements: ${passwordErrors.join(', ')}`, 400);
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      apiError(res, 'Email already registered', 409);
      return;
    }

    if (role && !(role in AdminRole)) {
      apiError(res, 'Invalid role', 400);
      return;
    }

    const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);

    const user = await prisma.user.create({
      data: { email, passwordHash, firstName, lastName: lastName ?? null, role: role as AdminRole },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
    });

    ok(res, user, 201);
  } catch {
    apiError(res, 'Failed to create user', 500);
  }
});

/**
 * GET /auth/users
 * Protected (SUPER_ADMIN only). Lists all users.
 */
authRouter.get('/users', authenticate, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, lastLoginAt: true },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, users);
  } catch {
    apiError(res, 'Failed to list users', 500);
  }
});


/**
 * GET /auth/me
 * Protected. Returns info about the authenticated user.
 */
authRouter.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user?.id ?? '' }, select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, passwordHash: false, lastLoginAt: true } });
    if (!user) return apiError(res, 'User not found', 404);
    ok(res, user);
  } catch {
    apiError(res, 'Failed to fetch user info', 500);
  }
});
