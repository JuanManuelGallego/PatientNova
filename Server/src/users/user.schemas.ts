import { AdminRole, AdminStatus, Channel } from '../../generated/prisma/client.ts';
import { z } from 'zod';
import { e164OrEmpty, strongPassword } from '../utils/types.js';
import { includeDeletedQuery } from '../utils/schemas.js';
import { isValidIANATimezone } from '../utils/timeUtils.ts';

export const updateUserSchema = z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    displayName: z.string().min(1).max(100).optional(),
    jobTitle: z.string().max(120).optional(),
    avatar: z.string().max(500_000).nullable().optional(), // base64 data URL ≤ ~375 KB raw
    logo: z.string().max(500_000).nullable().optional(), // base64 data URL ≤ ~375 KB raw
    altLogo: z.string().max(500_000).nullable().optional(), // base64 data URL ≤ ~375 KB raw
    phoneNumber: e164OrEmpty,
    whatsappNumber: e164OrEmpty,
    reminderActive: z.boolean().optional(),
    reminderChannel: z.enum(Channel).optional(),
    timezone: z.string().max(50).optional().refine(
        tz => !tz || isValidIANATimezone(tz),
        { message: 'Invalid IANA timezone identifier' }
    ),
    bankName: z.string().max(120).optional(),
    accountNumber: z.string().max(120).optional(),
    nationalId: z.string().max(120).optional(),
    bankingKey: z.string().max(120).optional(),
});

export const superAdminUpdateUserSchema = z.object({
    email: z.string().email().optional(),
    role: z.enum(AdminRole).optional(),
    status: z.enum(AdminStatus).optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    displayName: z.string().min(1).max(100).optional(),
    avatar: z.string().max(500_000).nullable().optional(), // base64 data URL ≤ ~375 KB raw
    logo: z.string().max(500_000).nullable().optional(), // base64 data URL ≤ ~375 KB raw
    altLogo: z.string().max(500_000).nullable().optional(), // base64 data URL ≤ ~375 KB raw
    jobTitle: z.string().max(120).optional(),
    phoneNumber: e164OrEmpty,
    whatsappNumber: e164OrEmpty,
    reminderActive: z.boolean().optional(),
    reminderChannel: z.enum(Channel).optional(),
    timezone: z.string().max(50).optional().refine(
        tz => !tz || isValidIANATimezone(tz),
        { message: 'Invalid IANA timezone identifier' }
    ),
    bankName: z.string().max(120).optional(),
    accountNumber: z.string().max(120).optional(),
    nationalId: z.string().max(120).optional(),
    bankingKey: z.string().max(120).optional(),
});

export const createUserSchema = z.object({
    email: z.email(),
    password: strongPassword,
    role: z.enum(AdminRole),
    status: z.enum(AdminStatus),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    displayName: z.string().min(1).max(100).optional(),
    avatar: z.string().max(500_000).nullable().optional(), // base64 data URL ≤ ~375 KB raw
    logo: z.string().max(500_000).nullable().optional(), // base64 data URL ≤ ~375 KB raw
    altLogo: z.string().max(500_000).nullable().optional(), // base64 data URL ≤ ~375 KB raw
    jobTitle: z.string().max(120).optional(),
    phoneNumber: e164OrEmpty,
    whatsappNumber: e164OrEmpty,
    reminderActive: z.boolean().optional(),
    reminderChannel: z.enum(Channel).optional(),
    timezone: z.string().max(50).optional().refine(
        tz => !tz || isValidIANATimezone(tz),
        { message: 'Invalid IANA timezone identifier' }
    ),
    bankName: z.string().max(120).optional(),
    accountNumber: z.string().max(120).optional(),
    nationalId: z.string().max(120).optional(),
    bankingKey: z.string().max(120).optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type SuperAdminUpdateUserDto = z.infer<typeof superAdminUpdateUserSchema>;

export const listUsersSchema = z.object({}).extend(includeDeletedQuery.shape);

export type ListUsersQuery = z.infer<typeof listUsersSchema>;