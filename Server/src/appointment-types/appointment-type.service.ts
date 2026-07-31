import { appointmentTypeRepository } from './appointment-type.repository.js';
import { logger } from '../utils/api/logger.js';
import { auditLogService } from '../audit-log/audit-log.service.js';
import { buildAuditEntry, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreateAppointmentTypeDto, UpdateAppointmentTypeDto } from './appointment-type.schemas.js';
import { updateAppointmentTypeSchema } from './appointment-type.schemas.js';
import type { AppointmentType } from '../../generated/prisma/client.ts';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const TYPE_DIFF_FIELDS = schemaKeys(updateAppointmentTypeSchema);

export const appointmentTypeService = {
  findById: appointmentTypeRepository.findById.bind(appointmentTypeRepository),
  findMany: appointmentTypeRepository.findMany.bind(appointmentTypeRepository),

  async create(dto: CreateAppointmentTypeDto, userId: string): Promise<AppointmentType> {
    const type = await appointmentTypeRepository.create(dto, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.APPOINTMENT_TYPE,
      entityId: type.id,
      actionType: ActionType.CREATE,
      description: `Created appointment type ${type.name}`,
      affectedFields: Object.keys(dto),
      fieldsAfter: dto as unknown as Record<string, unknown>,
    }));
    logger.info({ appointmentTypeId: type.id, userId, name: type.name }, 'Appointment type created');
    return type;
  },

  async update(id: string, dto: UpdateAppointmentTypeDto, userId: string): Promise<AppointmentType> {
    const before = await appointmentTypeRepository.findById(id, userId);
    const type = await appointmentTypeRepository.update(id, dto, userId);
    const diff = computeDiff(before as unknown as Record<string, unknown>, type as unknown as Record<string, unknown>, TYPE_DIFF_FIELDS);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.APPOINTMENT_TYPE,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: `Updated appointment type ${type.name}`,
      ...diff,
    }));
    logger.info({ appointmentTypeId: id, userId, fields: Object.keys(dto) }, 'Appointment type updated');
    return type;
  },

  async delete(id: string, userId: string): Promise<AppointmentType> {
    const before = await appointmentTypeRepository.findById(id, userId);
    const type = await appointmentTypeRepository.delete(id, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.APPOINTMENT_TYPE,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Deleted appointment type ${before.name}`,
      fieldsBefore: { name: before.name, defaultDuration: before.defaultDuration },
    }));
    logger.info({ appointmentTypeId: id, userId }, 'Appointment type deleted');
    return type;
  },

  async restore(id: string, userId: string): Promise<AppointmentType> {
    const type = await appointmentTypeRepository.restore(id, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.APPOINTMENT_TYPE,
      entityId: id,
      actionType: ActionType.RESTORE,
      description: `Restored appointment type ${type.name}`,
      fieldsAfter: { name: type.name, defaultDuration: type.defaultDuration },
    }));
    logger.info({ appointmentTypeId: id, userId }, 'Appointment type restored');
    return type;
  },
};
