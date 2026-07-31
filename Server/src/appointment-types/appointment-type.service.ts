import { appointmentTypeRepository } from './appointment-type.repository.js';
import { withAudit } from '../audit-log/with-audit.js';
import type { CreateAppointmentTypeDto, UpdateAppointmentTypeDto } from './appointment-type.schemas.js';
import { updateAppointmentTypeSchema } from './appointment-type.schemas.js';
import { EntityType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const TYPE_DIFF_FIELDS = schemaKeys(updateAppointmentTypeSchema);

export const appointmentTypeService = {
  findById: appointmentTypeRepository.findById.bind(appointmentTypeRepository),
  findMany: appointmentTypeRepository.findMany.bind(appointmentTypeRepository),

  create: withAudit(
    (dto: CreateAppointmentTypeDto, userId: string) => appointmentTypeRepository.create(dto, userId),
    {
      entityType: EntityType.APPOINTMENT_TYPE,
      action: 'CREATE',
      description: (t) => `Created appointment type ${t.name}`,
      affectedFields: (_t, dto) => Object.keys(dto as Record<string, unknown>),
      fieldsAfter: (_t, dto) => dto as unknown as Record<string, unknown>,
    },
  ),

  update: withAudit(
    (id: string, dto: UpdateAppointmentTypeDto, userId: string) =>
      appointmentTypeRepository.update(id, dto, userId),
    {
      entityType: EntityType.APPOINTMENT_TYPE,
      action: 'UPDATE',
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
      action: 'DELETE',
      description: (t) => `Deleted appointment type ${t.name}`,
      getBefore: (id, userId) =>
        appointmentTypeRepository.findById(id, userId as string) as Promise<Record<string, unknown>>,
      fieldsBefore: (before) => ({ name: before.name, defaultDuration: before.defaultDuration }),
    },
  ),

  restore: withAudit(
    (id: string, userId: string) => appointmentTypeRepository.restore(id, userId),
    {
      entityType: EntityType.APPOINTMENT_TYPE,
      action: 'RESTORE',
      description: (t) => `Restored appointment type ${t.name}`,
      fieldsAfter: (t) => ({ name: t.name, defaultDuration: t.defaultDuration }),
    },
  ),
};
