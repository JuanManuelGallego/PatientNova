import { prisma } from '../prisma/prismaClient.js';
import { config } from '../utils/config.js';
import bcrypt from 'bcrypt';
import type { CreateUserDto, UpdateUserDto, ListUsersQuery } from './user.schemas.js';
import { UserNotFoundError, UserEmailConflictError, UserInvalidCredentialsError } from '../utils/errors.js';
import { userInclude } from '../utils/types.js';
import { Channel } from '../../generated/prisma/enums.js';

export const userRepository = {
    async create(dto: CreateUserDto) {
        const existing = await prisma.user.findUnique({ where: { email: dto.email.toLowerCase() }, select: { id: true } });
        if (existing) throw new UserEmailConflictError(dto.email);

        const passwordHash = await bcrypt.hash(dto.password, config.auth.bcryptRounds);
        return prisma.user.create({
            data: {
                email: dto.email.toLowerCase(),
                passwordHash,
                role: dto.role,
                status: dto.status,
                firstName: dto.firstName,
                lastName: dto.lastName ?? null,
                displayName: dto.displayName ?? [ dto.firstName, dto.lastName ].filter(Boolean).join(' ') ?? null,
                avatar: dto.avatar ?? null,
                logo: dto.logo ?? null,
                altLogo: dto.altLogo ?? null,
                jobTitle: dto.jobTitle ?? null,
                phoneNumber: dto.phoneNumber ?? null,
                whatsappNumber: dto.whatsappNumber ?? null,
                reminderActive: dto.reminderActive ?? false,
                reminderChannel: dto.reminderChannel ?? Channel.WHATSAPP,
                timezone: dto.timezone ?? config.defaults.timezone,
            },
            select: userInclude,
        });
    },

    async findMany(query?: ListUsersQuery) {
        const includeDeleted = query?.includeDeleted ?? false;
        return prisma.user.findMany({
            where: { ...(includeDeleted ? {} : { isDeleted: false }) },
            select: userInclude,
            orderBy: { createdAt: 'desc' },
        });
    },

    async findById(id: string) {
        const user = await prisma.user.findUnique({ where: { id }, select: userInclude });
        if (!user) throw new UserNotFoundError(id);
        return user;
    },

    async update(id: string, dto: UpdateUserDto) {
        const data = Object.fromEntries(
            Object.entries(dto).filter(([ , v ]) => v !== undefined)
        );
        return prisma.user.update({
            where: { id },
            data,
            select: userInclude,
        });
    },

    async changePassword(id: string, currentPassword: string, newPassword: string) {
        const user = await prisma.user.findUnique({ where: { id }, select: { id: true, passwordHash: true } });
        if (!user) throw new UserNotFoundError(id);

        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) throw new UserInvalidCredentialsError();

        const passwordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);
        return prisma.user.update({
            where: { id },
            data: { passwordHash, lastPasswordChange: new Date(), refreshTokenVersion: { increment: 1 } },
            select: userInclude,
        });
    },

    async softDelete(id: string, deletedById?: string) {
        const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
        if (!user) throw new UserNotFoundError(id);

        return prisma.user.update({
            where: { id },
            data: { isDeleted: true, deletedAt: new Date(), deletedById: deletedById ?? null },
            select: userInclude,
        });
    },

    async restore(id: string) {
        const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
        if (!user) throw new UserNotFoundError(id);

        return prisma.user.update({
            where: { id },
            data: { isDeleted: false, deletedAt: null, deletedById: null },
            select: userInclude,
        });
    },
};
