import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authRepository } from './auth.repository.js';
import { config } from '../utils/config.js';
import { toUserResponse } from '../users/user.dto.js';
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
      throw new AuthInvalidCredentialsError();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AuthAccountLockedError();
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const failedAttempts = user.failedLoginAttempts + 1;
      let lockUntil: Date | undefined;
      if (failedAttempts >= config.lockout.maxFailedAttempts) {
        lockUntil = new Date(Date.now() + config.lockout.lockoutDurationMs);
      }
      await authRepository.incrementFailedAttempts(user.id, failedAttempts, lockUntil);
      throw new AuthInvalidCredentialsError();
    }

    const updatedUser = await authRepository.recordSuccessfulLogin(user.id, ip);

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
  },

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: unknown;
    try {
      payload = jwt.verify(refreshToken, config.auth.jwtSecret);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AuthRefreshTokenExpiredError();
      }
      throw new AuthRefreshTokenRevokedError();
    }

    if (!isRefreshTokenPayload(payload)) {
      throw new AuthRefreshTokenRevokedError();
    }

    const user = await authRepository.findByIdForAuth(payload.id);
    if (!user || user.status !== 'ACTIVE') {
      throw new AuthRefreshTokenRevokedError();
    }

    if (payload.version !== user.refreshTokenVersion) {
      throw new AuthRefreshTokenRevokedError();
    }

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
      throw new UserInvalidCredentialsError();
    }

    const passwordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);
    await authRepository.updatePassword(userId, passwordHash);
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
