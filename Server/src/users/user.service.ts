import { userRepository } from './user.repository.js';
import { logger } from '../utils/api/logger.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreateUserDto, UpdateUserDto } from './user.schemas.js';
import { updateUserSchema } from './user.schemas.js';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const USER_DIFF_FIELDS = schemaKeys(updateUserSchema);

export const userService = {
  findById: userRepository.findById.bind(userRepository),
  findMany: userRepository.findMany.bind(userRepository),

  async create(dto: CreateUserDto) {
    const user = await userRepository.create(dto);
    await logAudit({
      entityType: EntityType.USER,
      entityId: user.id,
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
    logger.info({ userId: user.id, email: user.email }, 'User created');
    return user;
  },

  async update(id: string, dto: UpdateUserDto) {
    const before = await userRepository.findById(id);
    const user = await userRepository.update(id, dto);
    const diff = computeDiff(before as unknown as Record<string, unknown>, user as unknown as Record<string, unknown>, USER_DIFF_FIELDS);
    await logAudit({
      entityType: EntityType.USER,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: `Usuario actualizado ${user.email}`,
      ...diff,
    });
    logger.info({ userId: id, fields: Object.keys(dto) }, 'User updated');
    return user;
  },

  async delete(id: string) {
    const before = await userRepository.findById(id);
    const user = await userRepository.delete(id);
    await logAudit({
      entityType: EntityType.USER,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Usuario eliminado ${before.email}`,
      affectedFields: ['isDeleted'],
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
      },
    });
    logger.info({ userId: id }, 'User deleted');
    return user;
  },

  async restore(id: string) {
    await userRepository.restore(id);
    const user = await userRepository.findById(id);
    await logAudit({
      entityType: EntityType.USER,
      entityId: id,
      actionType: ActionType.RESTORE,
      description: `Usuario restaurado ${user.email}`,
      affectedFields: ['isDeleted'],
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
