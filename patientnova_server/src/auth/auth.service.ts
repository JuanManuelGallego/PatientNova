import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authRepository } from './auth.repository.js';
import { config } from '../utils/config.js';
import { toUserResponse } from '../users/user.dto.js';
import { logger, maskEmail } from '../utils/logger.js';
import {
  AuthInvalidCredentialsError,
  AuthAccountLockedError,
  AuthRefreshTokenExpiredError,
  AuthRefreshTokenRevokedError,
  UserInvalidCredentialsError,
  UserNotFoundError,
} from '../utils/errors.js';
import type { UserResponse } from '../users/user.dto.js';

interface RefreshTokenPayload {
  type: string;
  id: string;
  version: number;
}

function isRefreshTokenPayload(payload: unknown): payload is RefreshTokenPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'type' in payload &&
    'id' in payload &&
    'version' in payload &&
    (payload as RefreshTokenPayload).type === 'refresh'
  );
}

let _dummyHash: string | undefined;
async function getDummyHash(): Promise<string> {
  if (!_dummyHash) _dummyHash = await bcrypt.hash('__dummy_timing_sink__', config.auth.bcryptRounds);
  return _dummyHash;
}

export interface LoginResult {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  async login(email: string, password: string, ip: string): Promise<LoginResult> {
    const user = await authRepository.findByEmail(email);

    if (!user || user.status !== 'ACTIVE') {
      await bcrypt.compare(password, await getDummyHash());
      logger.info({ email: maskEmail(email), ip }, 'Login failed: invalid credentials or inactive');
      throw new AuthInvalidCredentialsError();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      logger.info({ email: maskEmail(email), ip, lockedUntil: user.lockedUntil }, 'Login failed: account locked');
      throw new AuthAccountLockedError();
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const failedAttempts = user.failedLoginAttempts + 1;
      let lockUntil: Date | undefined;
      const willLock = failedAttempts >= config.lockout.maxFailedAttempts;
      if (willLock) {
        lockUntil = new Date(Date.now() + config.lockout.lockoutDurationMs);
      }
      await authRepository.incrementFailedAttempts(user.id, failedAttempts, lockUntil);
      logger.info({ userId: user.id, email: maskEmail(email), ip, failedAttempts, willLock }, 'Login failed: incorrect password');
      throw new AuthInvalidCredentialsError();
    }

    const updatedUser = await authRepository.recordSuccessfulLogin(user.id, ip);
    logger.info({ userId: user.id, email: maskEmail(email), ip }, 'Login successful');

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, timezone: user.timezone },
      config.auth.jwtSecret,
      { expiresIn: '15m' },
    );

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh', version: user.refreshTokenVersion },
      config.auth.jwtSecret,
      { expiresIn: '7d' },
    );

    return {
      user: toUserResponse(updatedUser),
      accessToken,
      refreshToken,
    };
  },

  async logout(userId: string): Promise<void> {
    await authRepository.incrementRefreshTokenVersion(userId);
    logger.info({ userId }, 'User logged out');
  },

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: unknown;
    try {
      payload = jwt.verify(refreshToken, config.auth.jwtSecret);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        logger.info('Token refresh failed: refresh token expired');
        throw new AuthRefreshTokenExpiredError();
      }
      logger.info('Token refresh failed: refresh token invalid or revoked');
      throw new AuthRefreshTokenRevokedError();
    }

    if (!isRefreshTokenPayload(payload)) {
      logger.warn({ payload }, 'Token refresh failed: malformed refresh token payload');
      throw new AuthRefreshTokenRevokedError();
    }

    const user = await authRepository.findByIdForAuth(payload.id);
    if (!user || user.status !== 'ACTIVE') {
      logger.info({ userId: payload.id }, 'Token refresh failed: user not found or inactive');
      throw new AuthRefreshTokenRevokedError();
    }

    if (payload.version !== user.refreshTokenVersion) {
      logger.info({ userId: user.id, tokenVersion: payload.version, currentVersion: user.refreshTokenVersion }, 'Token refresh failed: version mismatch');
      throw new AuthRefreshTokenRevokedError();
    }

    logger.info({ userId: user.id }, 'Token refreshed');

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, timezone: user.timezone },
      config.auth.jwtSecret,
      { expiresIn: '15m' },
    );

    return { accessToken };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await authRepository.findByIdForAuth(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      logger.info({ userId }, 'Password change failed: incorrect current password');
      throw new UserInvalidCredentialsError();
    }

    const passwordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);
    await authRepository.updatePassword(userId, passwordHash);
    logger.info({ userId }, 'Password changed');
  },

  getCookieDefaults() {
    const isProduction = config.env === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'lax' : 'strict') as 'lax' | 'strict',
      ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
    };
  },
};
