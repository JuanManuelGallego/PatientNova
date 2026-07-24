// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../../../src/auth/auth.service.js';

vi.mock('../../../src/auth/auth.repository.js', () => ({
  authRepository: {
    findByEmail: vi.fn(),
    findByIdForAuth: vi.fn(),
    recordSuccessfulLogin: vi.fn(),
    incrementFailedAttempts: vi.fn(),
    incrementRefreshTokenVersion: vi.fn(),
    updatePassword: vi.fn(),
  },
}));

vi.mock('../../../src/utils/config/config.js', () => ({
  config: {
    auth: {
      jwtSecret: 'test-secret-key-for-jwt',
      bcryptRounds: 4,
    },
    lockout: {
      maxFailedAttempts: 3,
      lockoutDurationMs: 900000,
    },
    env: 'test',
    cookieDomain: undefined,
  },
}));

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  maskEmail: (e: string) => e.replace(/(.{2}).*(@.*)/, '$1***$2'),
}));

vi.mock('../../../src/users/user.dto.js', () => ({
  toUserResponse: (u: any) => ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role }),
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => {
  class TokenExpiredError extends Error {
    constructor(message: string, expiredAt: Date) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  }
  return {
    default: {
      sign: vi.fn(),
      verify: vi.fn(),
      TokenExpiredError,
    },
  };
});

import { authRepository } from '../../../src/auth/auth.repository.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const mockRepo = vi.mocked(authRepository);
const mockBcrypt = vi.mocked(bcrypt);
const mockJwt = vi.mocked(jwt);

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '$2b$04$hashedpassword',
  role: 'USER',
  timezone: 'America/Bogota',
  status: 'ACTIVE',
  failedLoginAttempts: 0,
  lockedUntil: null,
  refreshTokenVersion: 1,
  firstName: 'John',
  lastName: 'Doe',
  displayName: 'John Doe',
  lastLoginAt: null,
  lastLoginIp: null,
};

const fakeUpdatedUser = {
  ...fakeUser,
  lastLoginAt: new Date(),
  lastLoginIp: '127.0.0.1',
  failedLoginAttempts: 0,
  lockedUntil: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockBcrypt.hash.mockResolvedValue('$2b$04$hashed' as any);
});

describe('authService.login', () => {
  it('returns user, accessToken, and refreshToken on valid login', async () => {
    mockRepo.findByEmail.mockResolvedValue(fakeUser as any);
    mockBcrypt.compare.mockResolvedValue(true as any);
    mockRepo.recordSuccessfulLogin.mockResolvedValue(fakeUpdatedUser as any);
    mockJwt.sign.mockReturnValue('fake-jwt-token' as any);

    const result = await authService.login('test@example.com', 'password123', '127.0.0.1');

    expect(mockRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
    expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', '$2b$04$hashedpassword');
    expect(mockRepo.recordSuccessfulLogin).toHaveBeenCalledWith('user-1', '127.0.0.1');
    expect(mockJwt.sign).toHaveBeenCalledTimes(2);
    expect(result.accessToken).toBe('fake-jwt-token');
    expect(result.refreshToken).toBe('fake-jwt-token');
  });

  it('signs JWT with correct payload for access token', async () => {
    mockRepo.findByEmail.mockResolvedValue(fakeUser as any);
    mockBcrypt.compare.mockResolvedValue(true as any);
    mockRepo.recordSuccessfulLogin.mockResolvedValue(fakeUpdatedUser as any);
    mockJwt.sign.mockReturnValue('token' as any);

    await authService.login('test@example.com', 'password123', '127.0.0.1');

    expect(mockJwt.sign).toHaveBeenCalledWith(
      { id: 'user-1', email: 'test@example.com', role: 'USER', timezone: 'America/Bogota' },
      'test-secret-key-for-jwt',
      { expiresIn: '15m' },
    );
  });

  it('signs JWT with correct payload for refresh token', async () => {
    mockRepo.findByEmail.mockResolvedValue(fakeUser as any);
    mockBcrypt.compare.mockResolvedValue(true as any);
    mockRepo.recordSuccessfulLogin.mockResolvedValue(fakeUpdatedUser as any);
    mockJwt.sign.mockReturnValue('token' as any);

    await authService.login('test@example.com', 'password123', '127.0.0.1');

    expect(mockJwt.sign).toHaveBeenCalledWith(
      { id: 'user-1', type: 'refresh', version: 1 },
      'test-secret-key-for-jwt',
      { expiresIn: '7d' },
    );
  });

  it('throws AuthInvalidCredentialsError when user not found', async () => {
    mockRepo.findByEmail.mockResolvedValue(null);
    mockBcrypt.compare.mockResolvedValue(false as any);

    await expect(authService.login('unknown@example.com', 'pass', '127.0.0.1')).rejects.toThrow('Invalid credentials');
  });

  it('throws AuthInvalidCredentialsError when user is not ACTIVE', async () => {
    mockRepo.findByEmail.mockResolvedValue({ ...fakeUser, status: 'INACTIVE' } as any);
    mockBcrypt.compare.mockResolvedValue(false as any);

    await expect(authService.login('test@example.com', 'pass', '127.0.0.1')).rejects.toThrow('Invalid credentials');
  });

  it('throws AuthAccountLockedError when account is locked', async () => {
    const lockedUser = { ...fakeUser, lockedUntil: new Date(Date.now() + 60000) };
    mockRepo.findByEmail.mockResolvedValue(lockedUser as any);

    await expect(authService.login('test@example.com', 'pass', '127.0.0.1')).rejects.toThrow('Account temporarily locked');
    expect(mockBcrypt.compare).not.toHaveBeenCalled();
  });

  it('increments failed attempts on wrong password', async () => {
    mockRepo.findByEmail.mockResolvedValue(fakeUser as any);
    mockBcrypt.compare.mockResolvedValue(false as any);

    await expect(authService.login('test@example.com', 'wrong', '127.0.0.1')).rejects.toThrow('Invalid credentials');
    expect(mockRepo.incrementFailedAttempts).toHaveBeenCalledWith('user-1', 1, undefined);
  });

  it('locks account after max failed attempts', async () => {
    const almostLockedUser = { ...fakeUser, failedLoginAttempts: 2 };
    mockRepo.findByEmail.mockResolvedValue(almostLockedUser as any);
    mockBcrypt.compare.mockResolvedValue(false as any);

    await expect(authService.login('test@example.com', 'wrong', '127.0.0.1')).rejects.toThrow('Invalid credentials');
    expect(mockRepo.incrementFailedAttempts).toHaveBeenCalledWith('user-1', 3, expect.any(Date));
  });

  it('still throws AuthInvalidCredentialsError when incrementFailedAttempts DB fails', async () => {
    mockRepo.findByEmail.mockResolvedValue(fakeUser as any);
    mockBcrypt.compare.mockResolvedValue(false as any);
    mockRepo.incrementFailedAttempts.mockRejectedValue(new Error('DB connection lost'));

    await expect(authService.login('test@example.com', 'wrong', '127.0.0.1')).rejects.toThrow('Invalid credentials');
  });
});

describe('authService.logout', () => {
  it('increments refresh token version', async () => {
    mockRepo.incrementRefreshTokenVersion.mockResolvedValue(undefined as any);
    await authService.logout('user-1');
    expect(mockRepo.incrementRefreshTokenVersion).toHaveBeenCalledWith('user-1');
  });
});

describe('authService.refreshToken', () => {
  it('returns new access token on valid refresh token', async () => {
    mockJwt.verify.mockReturnValue({ id: 'user-1', type: 'refresh', version: 1 } as any);
    mockRepo.findByIdForAuth.mockResolvedValue(fakeUser as any);
    mockJwt.sign.mockReturnValue('new-access-token' as any);

    const result = await authService.refreshToken('valid-refresh-token');

    expect(mockJwt.verify).toHaveBeenCalledWith('valid-refresh-token', 'test-secret-key-for-jwt');
    expect(mockRepo.findByIdForAuth).toHaveBeenCalledWith('user-1');
    expect(result.accessToken).toBe('new-access-token');
  });

  it('throws AuthRefreshTokenExpiredError when token is expired', async () => {
    mockJwt.verify.mockImplementation(() => { throw new mockJwt.TokenExpiredError('jwt expired', new Date()); });

    await expect(authService.refreshToken('expired-token')).rejects.toThrow('Refresh token expired');
  });

  it('throws AuthRefreshTokenRevokedError when token is invalid', async () => {
    mockJwt.verify.mockImplementation(() => { throw new Error('invalid token'); });

    await expect(authService.refreshToken('bad-token')).rejects.toThrow('Refresh token has been revoked');
  });

  it('throws AuthRefreshTokenRevokedError for malformed payload', async () => {
    mockJwt.verify.mockReturnValue({ id: 'user-1', type: 'access' } as any);

    await expect(authService.refreshToken('token')).rejects.toThrow('Refresh token has been revoked');
  });

  it('throws AuthRefreshTokenRevokedError when user not found', async () => {
    mockJwt.verify.mockReturnValue({ id: 'user-1', type: 'refresh', version: 1 } as any);
    mockRepo.findByIdForAuth.mockResolvedValue(null);

    await expect(authService.refreshToken('token')).rejects.toThrow('Refresh token has been revoked');
  });

  it('throws AuthRefreshTokenRevokedError when user is inactive', async () => {
    mockJwt.verify.mockReturnValue({ id: 'user-1', type: 'refresh', version: 1 } as any);
    mockRepo.findByIdForAuth.mockResolvedValue({ ...fakeUser, status: 'INACTIVE' } as any);

    await expect(authService.refreshToken('token')).rejects.toThrow('Refresh token has been revoked');
  });

  it('throws AuthRefreshTokenRevokedError when token version mismatch', async () => {
    mockJwt.verify.mockReturnValue({ id: 'user-1', type: 'refresh', version: 1 } as any);
    mockRepo.findByIdForAuth.mockResolvedValue({ ...fakeUser, refreshTokenVersion: 2 } as any);

    await expect(authService.refreshToken('token')).rejects.toThrow('Refresh token has been revoked');
  });
});

describe('authService.changePassword', () => {
  it('updates password when current password is correct', async () => {
    mockRepo.findByIdForAuth.mockResolvedValue(fakeUser as any);
    mockBcrypt.compare.mockResolvedValue(true as any);
    mockBcrypt.hash.mockResolvedValue('$2b$04$newhash' as any);
    mockRepo.updatePassword.mockResolvedValue(undefined as any);

    await authService.changePassword('user-1', 'oldpass', 'newpass');

    expect(mockBcrypt.compare).toHaveBeenCalledWith('oldpass', '$2b$04$hashedpassword');
    expect(mockBcrypt.hash).toHaveBeenCalledWith('newpass', 4);
    expect(mockRepo.updatePassword).toHaveBeenCalledWith('user-1', '$2b$04$newhash');
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    mockRepo.findByIdForAuth.mockResolvedValue(null);

    await expect(authService.changePassword('bad-id', 'old', 'new')).rejects.toThrow('User with id "bad-id" not found');
  });

  it('throws UserInvalidCredentialsError when current password is wrong', async () => {
    mockRepo.findByIdForAuth.mockResolvedValue(fakeUser as any);
    mockBcrypt.compare.mockResolvedValue(false as any);

    await expect(authService.changePassword('user-1', 'wrong', 'new')).rejects.toThrow('Current password is incorrect');
    expect(mockRepo.updatePassword).not.toHaveBeenCalled();
  });
});

describe('authService.getCookieDefaults', () => {
  it('returns cross-origin safe cookie defaults', () => {
    expect(authService.getCookieDefaults()).toEqual(
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'none' })
    );
  });
});
