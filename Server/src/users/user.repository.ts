import { prisma } from '../prisma/prismaClient.js';
import { config } from '../utils/config.js';
import bcrypt from 'bcrypt';
import type { CreateUserDto, UpdateUserDto, ListUsersQuery } from './user.schemas.js';
import { UserNotFoundError, UserEmailConflictError } from '../utils/errors.js';
import { userInclude } from '../utils/types.js';
import { Channel } from '../../generated/prisma/enums.js';
import { softDelete, restore } from '../utils/softDelete.js';
import { assertUnique } from '../utils/assertUnique.js';
import { buildUpdateData } from '../utils/buildUpdateData.js';

export const userRepository = {
    async create(dto: CreateUserDto) {
        await assertUnique(
            () => prisma.user.findUnique({ where: { email: dto.email.toLowerCase() }, select: { id: true } }),
            UserEmailConflictError,
            dto.email,
        );

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
        const data = buildUpdateData(
            dto,
            [ 'firstName', 'lastName', 'displayName', 'jobTitle', 'avatar', 'logo', 'altLogo', 'phoneNumber', 'whatsappNumber', 'reminderActive', 'reminderChannel', 'timezone', 'bankName', 'accountNumber', 'nationalId', 'bankingKey' ],
        );
        return prisma.user.update({
            where: { id },
            data,
            select: userInclude,
        });
    },

    async delete(id: string) {
        const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
        if (!user) throw new UserNotFoundError(id);

        return softDelete(prisma.user, id);
    },

    async restore(id: string) {
        const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
        if (!user) throw new UserNotFoundError(id);

        return restore(prisma.user, id);
    },
};
