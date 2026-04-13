import { AdminRole, AdminStatus, Channel } from '@prisma/client';
import { z } from 'zod';
import { e164OrEmpty, strongPassword } from '../utils/types.js';

function isValidIANATimezone(tz: string): boolean {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

export const uuidParamSchema = z.object({ id: z.string().uuid() });

export const updateUserSchema = z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    displayName: z.string().min(1).max(100).optional(),
    jobTitle: z.string().max(120).optional(),
    avatarUrl: z.string().max(500_000).nullable().optional(), // base64 data URL ≤ ~375 KB raw
    phoneNumber: e164OrEmpty,
    whatsappNumber: e164OrEmpty,
    reminderActive: z.boolean().optional(),
    reminderChannel: z.nativeEnum(Channel).optional(),
    timezone: z.string().max(50).optional().refine(
        tz => !tz || isValidIANATimezone(tz),
        { message: 'Invalid IANA timezone identifier' }
    ),
});

export const superAdminUpdateUserSchema = z.object({
    email: z.string().email().optional(),
    role: z.nativeEnum(AdminRole).optional(),
    status: z.nativeEnum(AdminStatus).optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    displayName: z.string().min(1).max(100).optional(),
    avatarUrl: z.string().max(500_000).nullable().optional(), // base64 data URL ≤ ~375 KB raw
    jobTitle: z.string().max(120).optional(),
    phoneNumber: e164OrEmpty,
    whatsappNumber: e164OrEmpty,
    reminderActive: z.boolean().optional(),
    reminderChannel: z.nativeEnum(Channel).optional(),
    timezone: z.string().max(50).optional().refine(
        tz => !tz || isValidIANATimezone(tz),
        { message: 'Invalid IANA timezone identifier' }
    ),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: strongPassword,
});

export const createUserSchema = z.object({
    email: z.string().email(),
    password: strongPassword,
    role: z.nativeEnum(AdminRole),
    status: z.nativeEnum(AdminStatus),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    displayName: z.string().min(1).max(100).optional(),
    avatarUrl: z.string().max(500_000).nullable().optional(), // base64 data URL ≤ ~375 KB raw
    jobTitle: z.string().max(120).optional(),
    phoneNumber: e164OrEmpty,
    whatsappNumber: e164OrEmpty,
    reminderActive: z.boolean().optional(),
    reminderChannel: z.nativeEnum(Channel).optional(),
    timezone: z.string().max(50).optional().refine(
        tz => !tz || isValidIANATimezone(tz),
        { message: 'Invalid IANA timezone identifier' }
    ),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type SuperAdminUpdateUserDto = z.infer<typeof superAdminUpdateUserSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;