import type { Prisma } from '@prisma/client';
import { userInclude } from '../utils/types.js';

/**
 * The public user shape returned in all API responses.
 * Sensitive fields (passwordHash, failedLoginAttempts, lockedUntil,
 * refreshTokenVersion, lastLoginIp) are intentionally excluded.
 */
export type UserResponse = Prisma.UserGetPayload<{ select: typeof userInclude }>;

/**
 * Maps any object with the full Prisma User fields to the safe public response shape,
 * explicitly dropping every sensitive field.
 *
 * Useful in auth handlers that already hold the full user record in memory and want to
 * avoid a second `SELECT` with a `select` clause.
 */
export function toUserResponse(user: Parameters<typeof _extractFields>[0]): UserResponse {
  return _extractFields(user);
}

function _extractFields(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  role: string;
  status: string;
  timezone: string;
  lastLoginAt: Date | null;
  reminderActive: boolean;
  reminderChannel: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UserResponse {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    jobTitle: user.jobTitle,
    role: user.role as UserResponse['role'],
    status: user.status as UserResponse['status'],
    timezone: user.timezone,
    lastLoginAt: user.lastLoginAt,
    reminderActive: user.reminderActive,
    reminderChannel: user.reminderChannel as UserResponse['reminderChannel'],
    phoneNumber: user.phoneNumber,
    whatsappNumber: user.whatsappNumber,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
