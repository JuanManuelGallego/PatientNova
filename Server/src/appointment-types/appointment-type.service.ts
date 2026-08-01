import { appointmentTypeRepository } from './appointment-type.repository.js';
import type { CreateAppointmentTypeDto, UpdateAppointmentTypeDto } from './appointment-type.schemas.js';
import { updateAppointmentTypeSchema } from './appointment-type.schemas.js';
import { ActionType, EntityType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';

const TYPE_DIFF_FIELDS = schemaKeys(updateAppointmentTypeSchema);

export const appointmentTypeService = {
  findById: appointmentTypeRepository.findById.bind(appointmentTypeRepository),
  findMany: appointmentTypeRepository.findMany.bind(appointmentTypeRepository),

  async create(dto: CreateAppointmentTypeDto, userId: string) {
    const createdType = await appointmentTypeRepository.create(dto, userId);
    await logAudit({
      entityType: EntityType.APPOINTMENT_TYPE,
      entityId: createdType.id,
      actionType: ActionType.CREATE,
      description: `Tipo de cita creado ${createdType.name}`,
      affectedFields: Object.keys(dto),
      fieldsAfter: dto as unknown as Record<string, unknown>,
    });
    return createdType;
  },

  async update(id: string, dto: UpdateAppointmentTypeDto, userId: string) {
    const existingType = await appointmentTypeRepository.findById(id, userId);
    const updatedType = await appointmentTypeRepository.update(id, dto, userId);
    const diff = computeDiff(existingType as unknown as Record<string, unknown>, updatedType as unknown as Record<string, unknown>, TYPE_DIFF_FIELDS);
    await logAudit({
      entityType: EntityType.APPOINTMENT_TYPE,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: `Tipo de cita actualizado ${updatedType.name}`,
      ...diff,
    });
    return updatedType;
  },

  async delete(id: string, userId: string): Promise<{ id: string }> {
    const deletedType = await appointmentTypeRepository.delete(id, userId);
    await logAudit({
      entityType: EntityType.APPOINTMENT_TYPE,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Tipo de cita eliminado ${deletedType.name}`,
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: false },
      fieldsAfter: { isDeleted: true },
    });
    return { id };
  },

  async restore(id: string, userId: string) {
    const restoredType = await appointmentTypeRepository.restore(id, userId);
    await logAudit({
      entityType: EntityType.APPOINTMENT_TYPE,
      entityId: id,
      actionType: ActionType.RESTORE,
      description: `Tipo de cita restaurado ${restoredType.name}`,
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: true },
      fieldsAfter: { isDeleted: false },
    });
    return restoredType;
  },
};
