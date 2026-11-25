import { prisma } from '../utils/prisma/prisma-client.js';
import { config } from '../utils/config/config.js';
import bcrypt from 'bcrypt';
import type { CreateUserDto, UpdateUserDto, SuperAdminUpdateUserDto, ListUsersQuery } from './user.schemas.js';
import { UserNotFoundError } from '../utils/errors/errors.js';
import { UserEmailConflictError } from './user.errors.js';
import { superAdminUpdateUserSchema } from './user.schemas.js';
import { schemaKeys } from '../utils/validation/schema-keys.js';
import { userInclude, userListInclude } from './user.types.js';
import { Channel } from '../../generated/prisma/enums.js';
import { assertUnique } from '../utils/validation/assertUnique.js';
import { buildUpdateData } from '../utils/prisma/build-update-data.js';
import { emptyToNull } from '../utils/prisma/empty-to-null.js';
import { ensureDefaultPatientType } from '../patient-types/patient-type.service.js';

export const userRepository = {
    async create(dto: CreateUserDto) {
        await assertUnique(
            () => prisma.user.findUnique({ where: { email: dto.email.toLowerCase() }, select: { id: true } }),
            UserEmailConflictError,
            dto.email,
        );

        const passwordHash = await bcrypt.hash(dto.password, config.auth.bcryptRounds);
        // Every account starts with one default patient type ("General"), in the same transaction.
        return prisma.$transaction(async (tx) => {
            const { id } = await tx.user.create({
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
                select: { id: true },
            });
            await ensureDefaultPatientType(tx, id);
            return tx.user.findUniqueOrThrow({ where: { id }, select: userInclude });
        });
    },

    async findMany(query?: ListUsersQuery) {
        const includeDeleted = query?.includeDeleted ?? false;
        return prisma.user.findMany({
            where: { ...(includeDeleted ? {} : { isDeleted: false }) },
            select: userListInclude,
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
            {
                phoneNumber: emptyToNull,
                whatsappNumber: emptyToNull,
            },
        );
        return prisma.user.update({
            where: { id },
            data,
            select: userInclude,
        });
    },

    async adminUpdate(id: string, dto: SuperAdminUpdateUserDto) {
        const current = await prisma.user.findUnique({ where: { id }, select: { email: true, role: true, status: true } });
        if (!current) throw new UserNotFoundError(id);

        const email = dto.email?.toLowerCase();
        if (email !== undefined && email !== current.email) {
            await assertUnique(
                () => prisma.user.findFirst({ where: { email, NOT: { id } }, select: { id: true } }),
                UserEmailConflictError,
                email,
            );
        }

        const data = buildUpdateData(
            { ...dto, ...(email !== undefined && { email }) },
            [ ...schemaKeys(superAdminUpdateUserSchema) ] as (keyof SuperAdminUpdateUserDto)[],
            {
                phoneNumber: emptyToNull,
                whatsappNumber: emptyToNull,
            },
        );
        const credentialsChanged =
            (email !== undefined && email !== current.email) ||
            (dto.role !== undefined && dto.role !== current.role) ||
            (dto.status !== undefined && dto.status !== current.status);
        if (credentialsChanged) data.refreshTokenVersion = { increment: 1 };

        return prisma.user.update({ where: { id }, data, select: userInclude });
    },

    async delete(id: string) {
        const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
        if (!user) throw new UserNotFoundError(id);

        return prisma.user.update({
            where: { id },
            data: { isDeleted: true, deletedAt: new Date(), refreshTokenVersion: { increment: 1 } },
            select: userInclude,
        });
    },

    async restore(id: string) {
        const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
        if (!user) throw new UserNotFoundError(id);

        return prisma.user.update({
            where: { id },
            data: { isDeleted: false, deletedAt: null },
            select: userInclude,
        });
    },
};
