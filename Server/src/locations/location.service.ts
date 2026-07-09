import { locationRepository } from './location.repository.js';
import { logger } from '../utils/logger.js';
import type { CreateLocationDto, UpdateLocationDto } from './location.schemas.js';
import type { AppointmentLocation } from '../../generated/prisma/client.ts';

export const locationService = {
  findById: locationRepository.findById.bind(locationRepository),
  findMany: locationRepository.findMany.bind(locationRepository),

  async create(dto: CreateLocationDto, userId: string): Promise<AppointmentLocation> {
    const location = await locationRepository.create(dto, userId);
    logger.info({ locationId: location.id, userId, name: location.name }, 'Location created');
    return location;
  },

  async update(id: string, dto: UpdateLocationDto, userId: string): Promise<AppointmentLocation> {
    const location = await locationRepository.update(id, dto, userId);
    logger.info({ locationId: id, userId, fields: Object.keys(dto) }, 'Location updated');
    return location;
  },

  async delete(id: string, userId: string): Promise<AppointmentLocation> {
    const location = await locationRepository.delete(id, userId);
    logger.info({ locationId: id, userId }, 'Location deleted');
    return location;
  },

  async restore(id: string, userId: string): Promise<AppointmentLocation> {
    const location = await locationRepository.restore(id, userId);
    logger.info({ locationId: id, userId }, 'Location restored');
    return location;
  },
};
