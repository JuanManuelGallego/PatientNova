import { userRepository } from './user.repository.js';
import { logger, maskEmail } from '../utils/api/logger.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreateUserDto, UpdateUserDto, SuperAdminUpdateUserDto } from './user.schemas.js';
import { updateUserSchema, superAdminUpdateUserSchema } from './user.schemas.js';
import { UserSelfLockoutError } from './user.errors.js';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const USER_DIFF_FIELDS = schemaKeys(updateUserSchema);
const ADMIN_USER_DIFF_FIELDS = schemaKeys(superAdminUpdateUserSchema);

export const userService = {
  findById: userRepository.findById.bind(userRepository),
  findMany: userRepository.findMany.bind(userRepository),

  async create(dto: CreateUserDto, auditUserId: string) {
    const user = await userRepository.create(dto);
    await logAudit({
      entityType: EntityType.USER,
      entityId: user.id,
      userId: auditUserId,
      actionType: ActionType.CREATE,
      description: `Usuario creado ${user.email}`,
      affectedFields: Object.keys(dto),
      fieldsAfter: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        logo: user.logo,
        altLogo: user.altLogo,
        jobTitle: user.jobTitle,
        phoneNumber: user.phoneNumber,
        whatsappNumber: user.whatsappNumber,
        reminderActive: user.reminderActive,
        reminderChannel: user.reminderChannel,
        timezone: user.timezone,
        bankName: user.bankName,
        accountNumber: user.accountNumber,
        nationalId: user.nationalId,
        bankingKey: user.bankingKey,
      },
    });
    logger.info({ userId: user.id, maskedEmail: maskEmail(user.email) }, 'User created');
    return user;
  },

  async update(id: string, dto: UpdateUserDto, auditUserId: string) {
    const before = await userRepository.findById(id);
    const user = await userRepository.update(id, dto);
    const diff = computeDiff(before as unknown as Record<string, unknown>, user as unknown as Record<string, unknown>, USER_DIFF_FIELDS);
    await logAudit({
      entityType: EntityType.USER,
      entityId: id,
      userId: auditUserId,
      actionType: ActionType.UPDATE,
      description: `Usuario actualizado ${user.email}`,
      ...diff,
    });
    logger.info({ userId: id, fields: Object.keys(dto) }, 'User updated');
    return user;
  },

  async adminUpdate(id: string, dto: SuperAdminUpdateUserDto, actorId: string) {
    if (id === actorId && ((dto.role !== undefined && dto.role !== 'SUPER_ADMIN') || (dto.status !== undefined && dto.status !== 'ACTIVE'))) {
      throw new UserSelfLockoutError();
    }
    const before = await userRepository.findById(id);
    const user = await userRepository.adminUpdate(id, dto);
    const diff = computeDiff(before as unknown as Record<string, unknown>, user as unknown as Record<string, unknown>, ADMIN_USER_DIFF_FIELDS);
    await logAudit({
      entityType: EntityType.USER,
      entityId: id,
      userId: actorId,
      actionType: ActionType.UPDATE,
      description: `Usuario actualizado ${user.email}`,
      ...diff,
    });
    logger.info({ userId: id, fields: Object.keys(dto) }, 'User updated by super admin');
    return user;
  },

  async delete(id: string, actorId: string) {
    if (id === actorId) throw new UserSelfLockoutError();
    const before = await userRepository.findById(id);
    const user = await userRepository.delete(id);
    await logAudit({
      entityType: EntityType.USER,
      entityId: id,
      userId: actorId,
      actionType: ActionType.DELETE,
      description: `Usuario eliminado ${before.email}`,
      affectedFields: ['isDeleted', 'email', 'firstName', 'lastName', 'displayName', 'role', 'status'],
      fieldsBefore: {
        isDeleted: false,
        email: before.email,
        firstName: before.firstName,
        lastName: before.lastName,
        displayName: before.displayName,
        role: before.role,
        status: before.status,
      },
      fieldsAfter: {
        isDeleted: true,
        email: before.email,
        firstName: before.firstName,
        lastName: before.lastName,
        displayName: before.displayName,
        role: before.role,
        status: before.status,
      },
    });
    logger.info({ userId: id }, 'User deleted');
    return user;
  },

  async restore(id: string, auditUserId: string) {
    await userRepository.restore(id);
    const user = await userRepository.findById(id);
    await logAudit({
      entityType: EntityType.USER,
      entityId: id,
      userId: auditUserId,
      actionType: ActionType.RESTORE,
      description: `Usuario restaurado ${user.email}`,
      affectedFields: ['isDeleted', 'email', 'firstName', 'lastName', 'displayName', 'role', 'status', 'avatar', 'logo', 'altLogo', 'jobTitle', 'phoneNumber', 'whatsappNumber', 'reminderActive', 'reminderChannel', 'timezone', 'bankName', 'accountNumber', 'nationalId', 'bankingKey'],
      fieldsBefore: {
        isDeleted: true,
      },
      fieldsAfter: {
        isDeleted: false,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        logo: user.logo,
        altLogo: user.altLogo,
        jobTitle: user.jobTitle,
        phoneNumber: user.phoneNumber,
        whatsappNumber: user.whatsappNumber,
        reminderActive: user.reminderActive,
        reminderChannel: user.reminderChannel,
        timezone: user.timezone,
        bankName: user.bankName,
        accountNumber: user.accountNumber,
        nationalId: user.nationalId,
        bankingKey: user.bankingKey,
      },
    });
    logger.info({ userId: id }, 'User restored');
    return user;
  },
};
