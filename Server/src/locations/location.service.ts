import { locationRepository } from './location.repository.js';
import { withAudit } from '../audit-log/with-audit.js';
import type { CreateLocationDto, UpdateLocationDto } from './location.schemas.js';
import { updateLocationSchema } from './location.schemas.js';
import { ActionType, EntityType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const LOCATION_DIFF_FIELDS = schemaKeys(updateLocationSchema);

export const locationService = {
  findById: locationRepository.findById.bind(locationRepository),
  findMany: locationRepository.findMany.bind(locationRepository),

  create: withAudit(
    (dto: CreateLocationDto, userId: string) => locationRepository.create(dto, userId),
    {
      entityType: EntityType.APPOINTMENT_LOCATION,
      action: ActionType.CREATE,
      description: (loc) => `Created location ${loc.name}`,
      affectedFields: (_loc, dto) => Object.keys(dto),
      fieldsAfter: (_loc, dto) => dto,
    },
  ),

  update: withAudit(
    (id: string, dto: UpdateLocationDto, userId: string) => locationRepository.update(id, dto, userId),
    {
      entityType: EntityType.APPOINTMENT_LOCATION,
      action: ActionType.UPDATE,
      description: (loc) => `Updated location ${loc.name}`,
      getBefore: (id, _dto, userId) =>
        locationRepository.findById(id, userId as string) as Promise<Record<string, unknown>>,
      diffFields: LOCATION_DIFF_FIELDS,
    },
  ),

  delete: withAudit(
    (id: string, userId: string) => locationRepository.delete(id, userId),
    {
      entityType: EntityType.APPOINTMENT_LOCATION,
      action: ActionType.DELETE,
      description: (loc) => `Deleted location ${loc.name}`,
      getBefore: (id, userId) =>
        locationRepository.findById(id, userId as string) as Promise<Record<string, unknown>>,
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
    (id: string, userId: string) => locationRepository.restore(id, userId),
    {
      entityType: EntityType.APPOINTMENT_LOCATION,
      action: ActionType.RESTORE,
      description: (loc) => `Restored location ${loc.name}`,
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
