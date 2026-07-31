import { locationRepository } from './location.repository.js';
import { logger } from '../utils/api/logger.js';
import { auditLogService } from '../audit-log/audit-log.service.js';
import { buildAuditEntry, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreateLocationDto, UpdateLocationDto } from './location.schemas.js';
import { updateLocationSchema } from './location.schemas.js';
import type { AppointmentLocation } from '../../generated/prisma/client.ts';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const LOCATION_DIFF_FIELDS = schemaKeys(updateLocationSchema);

export const locationService = {
  findById: locationRepository.findById.bind(locationRepository),
  findMany: locationRepository.findMany.bind(locationRepository),

  async create(dto: CreateLocationDto, userId: string): Promise<AppointmentLocation> {
    const location = await locationRepository.create(dto, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.APPOINTMENT_LOCATION,
      entityId: location.id,
      actionType: ActionType.CREATE,
      description: `Created location ${location.name}`,
      affectedFields: Object.keys(dto),
      fieldsAfter: dto as unknown as Record<string, unknown>,
    }));
    logger.info({ locationId: location.id, userId, name: location.name }, 'Location created');
    return location;
  },

  async update(id: string, dto: UpdateLocationDto, userId: string): Promise<AppointmentLocation> {
    const before = await locationRepository.findById(id, userId);
    const location = await locationRepository.update(id, dto, userId);
    const diff = computeDiff(before as unknown as Record<string, unknown>, location as unknown as Record<string, unknown>, LOCATION_DIFF_FIELDS);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.APPOINTMENT_LOCATION,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: `Updated location ${location.name}`,
      ...diff,
    }));
    logger.info({ locationId: id, userId, fields: Object.keys(dto) }, 'Location updated');
    return location;
  },

  async delete(id: string, userId: string): Promise<AppointmentLocation> {
    const before = await locationRepository.findById(id, userId);
    const location = await locationRepository.delete(id, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.APPOINTMENT_LOCATION,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Deleted location ${before.name}`,
      fieldsBefore: { name: before.name, address: before.address },
    }));
    logger.info({ locationId: id, userId }, 'Location deleted');
    return location;
  },

  async restore(id: string, userId: string): Promise<AppointmentLocation> {
    const location = await locationRepository.restore(id, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.APPOINTMENT_LOCATION,
      entityId: id,
      actionType: ActionType.RESTORE,
      description: `Restored location ${location.name}`,
      fieldsAfter: { name: location.name, address: location.address },
    }));
    logger.info({ locationId: id, userId }, 'Location restored');
    return location;
  },
};
