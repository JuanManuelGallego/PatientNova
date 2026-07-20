import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../prisma/prismaClient.js';
import { authService } from './auth.service.js';
import { createTestUser } from '../../test/integration/helpers.js';
import {
  AuthInvalidCredentialsError,
  AuthAccountLockedError,
  AuthRefreshTokenRevokedError,
  UserInvalidCredentialsError,
} from '../utils/errors.js';
import { config } from '../utils/config.js';

let user: { id: string; email: string };
const PASSWORD = 'Password123!';

beforeEach(async () => {
  const u = await createTestUser({ password: PASSWORD, status: 'ACTIVE' });
  user = { id: u.id, email: u.email };
});

describe('authService (integration)', () => {
  it('logs in with valid credentials and returns tokens', async () => {
    const result = await authService.login(user.email, PASSWORD, '127.0.0.1');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.id).toBe(user.id);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.failedLoginAttempts).toBe(0);
    expect(updated!.lockedUntil).toBeNull();
    expect(updated!.lastLoginAt).toBeInstanceOf(Date);
  });

  it('rejects invalid password and increments failed attempts', async () => {
    await expect(authService.login(user.email, 'wrong-password', '127.0.0.1'))
      .rejects.toThrow(AuthInvalidCredentialsError);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.failedLoginAttempts).toBe(1);
  });

  it('locks the account after max failed attempts', async () => {
    const max = config.lockout.maxFailedAttempts;
    for (let i = 0; i < max; i++) {
      await authService.login(user.email, 'wrong-password', '127.0.0.1').catch(() => {});
    }

    const locked = await prisma.user.findUnique({ where: { id: user.id } });
    expect(locked!.lockedUntil).toBeInstanceOf(Date);
    expect(locked!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    await expect(authService.login(user.email, PASSWORD, '127.0.0.1'))
      .rejects.toThrow(AuthAccountLockedError);
  });

  it('refreshes the access token with a valid refresh token', async () => {
    const { refreshToken } = await authService.login(user.email, PASSWORD, '127.0.0.1');
    const { accessToken } = await authService.refreshToken(refreshToken);
    expect(accessToken).toBeTruthy();
  });

  it('rejects a refresh token after logout (version bump)', async () => {
    const { refreshToken } = await authService.login(user.email, PASSWORD, '127.0.0.1');
    await authService.logout(user.id);

    await expect(authService.refreshToken(refreshToken))
      .rejects.toThrow(AuthRefreshTokenRevokedError);
  });

  it('rejects an expired/garbage refresh token', async () => {
    await expect(authService.refreshToken('not-a-real-token'))
      .rejects.toThrow(AuthRefreshTokenRevokedError);
  });

  it('changes the password and invalidates the old one', async () => {
    const NEW = 'NewPassword456!';
    await authService.changePassword(user.id, PASSWORD, NEW);

    await expect(authService.login(user.email, PASSWORD, '127.0.0.1'))
      .rejects.toThrow(AuthInvalidCredentialsError);

    const ok = await authService.login(user.email, NEW, '127.0.0.1');
    expect(ok.user.id).toBe(user.id);
  });

  it('rejects password change with wrong current password', async () => {
    await expect(authService.changePassword(user.id, 'wrong', 'NewPassword456!'))
      .rejects.toThrow(UserInvalidCredentialsError);
  });
});
