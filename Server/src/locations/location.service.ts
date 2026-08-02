import { locationRepository } from './location.repository.js';
import type { CreateLocationDto, UpdateLocationDto } from './location.schemas.js';
import { updateLocationSchema } from './location.schemas.js';
import { ActionType, EntityType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';

const LOCATION_DIFF_FIELDS = schemaKeys(updateLocationSchema);

export const locationService = {
  findById: locationRepository.findById.bind(locationRepository),
  findMany: locationRepository.findMany.bind(locationRepository),

  async create(dto: CreateLocationDto, userId: string) {
    const createdLocation = await locationRepository.create(dto, userId);
    await logAudit({
      entityType: EntityType.APPOINTMENT_LOCATION,
      entityId: createdLocation.id,
      actionType: ActionType.CREATE,
      description: `Ubicación creada ${createdLocation.name}`,
      affectedFields: Object.keys(dto),
      fieldsAfter: dto as unknown as Record<string, unknown>,
    });
    return createdLocation;
  },

  async update(id: string, dto: UpdateLocationDto, userId: string) {
    const existingLocation = await locationRepository.findById(id, userId);
    const updatedLocation = await locationRepository.update(id, dto, userId);
    const diff = computeDiff(existingLocation as unknown as Record<string, unknown>, updatedLocation as unknown as Record<string, unknown>, LOCATION_DIFF_FIELDS);
    await logAudit({
      entityType: EntityType.APPOINTMENT_LOCATION,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: `Ubicación actualizada ${updatedLocation.name}`,
      ...diff,
    });
    return updatedLocation;
  },

  async delete(id: string, userId: string): Promise<{ id: string }> {
    const deletedLocation = await locationRepository.delete(id, userId);
    await logAudit({
      entityType: EntityType.APPOINTMENT_LOCATION,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Ubicación eliminada ${deletedLocation.name}`,
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: false },
      fieldsAfter: { isDeleted: true },
    });
    return { id };
  },

  async restore(id: string, userId: string) {
    const restoredLocation = await locationRepository.restore(id, userId);
    await logAudit({
      entityType: EntityType.APPOINTMENT_LOCATION,
      entityId: id,
      actionType: ActionType.RESTORE,
      description: `Ubicación restaurada ${restoredLocation.name}`,
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: true },
      fieldsAfter: { isDeleted: false },
    });
    return restoredLocation;
  },
};
