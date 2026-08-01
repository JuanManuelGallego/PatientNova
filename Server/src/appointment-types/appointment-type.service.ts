import { appointmentTypeRepository } from './appointment-type.repository.js';
import { withAudit } from '../audit-log/with-audit.js';
import type { CreateAppointmentTypeDto, UpdateAppointmentTypeDto } from './appointment-type.schemas.js';
import { updateAppointmentTypeSchema } from './appointment-type.schemas.js';
import { ActionType, EntityType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const TYPE_DIFF_FIELDS = schemaKeys(updateAppointmentTypeSchema);

export const appointmentTypeService = {
  findById: appointmentTypeRepository.findById.bind(appointmentTypeRepository),
  findMany: appointmentTypeRepository.findMany.bind(appointmentTypeRepository),

  create: withAudit(
    (dto: CreateAppointmentTypeDto, userId: string) => appointmentTypeRepository.create(dto, userId),
    {
      entityType: EntityType.APPOINTMENT_TYPE,
      action: ActionType.CREATE,
      description: (t) => `Created appointment type ${t.name}`,
      affectedFields: (_t, dto) => Object.keys(dto),
      fieldsAfter: (_t, dto) => dto,
    },
  ),

  update: withAudit(
    (id: string, dto: UpdateAppointmentTypeDto, userId: string) =>
      appointmentTypeRepository.update(id, dto, userId),
    {
      entityType: EntityType.APPOINTMENT_TYPE,
      action: ActionType.UPDATE,
      description: (t) => `Updated appointment type ${t.name}`,
      getBefore: (id, _dto, userId) =>
        appointmentTypeRepository.findById(id, userId as string) as Promise<Record<string, unknown>>,
      diffFields: TYPE_DIFF_FIELDS,
    },
  ),

  delete: withAudit(
    (id: string, userId: string) => appointmentTypeRepository.delete(id, userId),
    {
      entityType: EntityType.APPOINTMENT_TYPE,
      action: ActionType.DELETE,
      description: (t) => `Deleted appointment type ${t.name}`,
      affectedFields: () => ['isDeleted'],
      fieldsBefore: () => ({
        isDeleted: false,
      }),
      fieldsAfter: () => ({
        isDeleted: true,
      }),
    },
  ),

  restore: withAudit(
    (id: string, userId: string) => appointmentTypeRepository.restore(id, userId),
    {
      entityType: EntityType.APPOINTMENT_TYPE,
      action: ActionType.RESTORE,
      description: (t) => `Restored appointment type ${t.name}`,
      affectedFields: () => ['isDeleted'],
      fieldsBefore: () => ({
        isDeleted: true,
      }),
      fieldsAfter: () => ({
        isDeleted: false,
      }),
    },
  ),
};
