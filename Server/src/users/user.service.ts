import { userRepository } from './user.repository.js';
import { logger } from '../utils/api/logger.js';
import { auditLogService } from '../audit-log/audit-log.service.js';
import { buildAuditEntry, computeDiff } from '../audit-log/audit-log.utils.js';
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
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.USER,
      entityId: user.id,
      actionType: ActionType.CREATE,
      description: `Created user ${user.email}`,
      affectedFields: Object.keys(dto),
      fieldsAfter: { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    }));
    logger.info({ userId: user.id, email: user.email }, 'User created');
    return user;
  },

  async update(id: string, dto: UpdateUserDto) {
    const before = await userRepository.findById(id);
    const user = await userRepository.update(id, dto);
    const diff = computeDiff(before as unknown as Record<string, unknown>, user as unknown as Record<string, unknown>, USER_DIFF_FIELDS);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.USER,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: `Updated user ${user.email}`,
      ...diff,
    }));
    logger.info({ userId: id, fields: Object.keys(dto) }, 'User updated');
    return user;
  },

  async delete(id: string) {
    const before = await userRepository.findById(id);
    const user = await userRepository.delete(id);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.USER,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Deleted user ${before.email}`,
      fieldsBefore: { email: before.email, firstName: before.firstName, lastName: before.lastName },
    }));
    logger.info({ userId: id }, 'User deleted');
    return user;
  },

  async restore(id: string) {
    await userRepository.restore(id);
    const user = await userRepository.findById(id);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.USER,
      entityId: id,
      actionType: ActionType.RESTORE,
      description: `Restored user ${user.email}`,
      fieldsAfter: { email: user.email, firstName: user.firstName, lastName: user.lastName },
    }));
    logger.info({ userId: id }, 'User restored');
    return user;
  },
};
