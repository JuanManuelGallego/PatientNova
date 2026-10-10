import { prisma } from '../utils/prisma/prisma-client.js';
import { userInclude } from '../users/user.types.js';

export interface UserForAuth {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  timezone: string | null;
  status: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  refreshTokenVersion: number;
}

const authSelect = {
  id: true,
  email: true,
  passwordHash: true,
  role: true,
  timezone: true,
  status: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  refreshTokenVersion: true,
};

export const authRepository = {
  async findByEmail(email: string): Promise<UserForAuth | null> {
    return prisma.user.findUnique({
      where: { email },
      select: authSelect,
    }) as unknown as UserForAuth | null;
  },

  async findByIdForAuth(id: string): Promise<UserForAuth | null> {
    return prisma.user.findUnique({
      where: { id },
      select: authSelect,
    }) as unknown as UserForAuth | null;
  },

  async recordSuccessfulLogin(id: string, ip: string) {
    return prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip.replace('::ffff:', '') ?? null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: userInclude,
    });
  },

  async recordFailedAttempt(id: string, maxAttempts: number, lockoutDurationMs: number): Promise<{ failedAttempts: number; locked: boolean }> {
    const { failedLoginAttempts } = await prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    const locked = failedLoginAttempts >= maxAttempts;
    if (locked) {
      await prisma.user.update({
        where: { id },
        data: { lockedUntil: new Date(Date.now() + lockoutDurationMs) },
      });
    }
    return { failedAttempts: failedLoginAttempts, locked };
  },

  async incrementRefreshTokenVersion(id: string) {
    await prisma.user.update({
      where: { id },
      data: { refreshTokenVersion: { increment: 1 } },
    });
  },

  async updatePassword(id: string, passwordHash: string) {
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        lastPasswordChange: new Date(),
        refreshTokenVersion: { increment: 1 },
      },
    });
  },
};
