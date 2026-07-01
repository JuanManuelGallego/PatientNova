import { locationRepository } from './location.repository.js';
import type { CreateLocationDto, UpdateLocationDto } from './location.schemas.js';
import type { AppointmentLocation } from '../../generated/prisma/client.ts';

export const locationService = {
  findById: locationRepository.findById.bind(locationRepository),
  findMany: locationRepository.findMany.bind(locationRepository),

  async create(dto: CreateLocationDto, userId: string): Promise<AppointmentLocation> {
    return locationRepository.create(dto, userId);
  },

  async update(id: string, dto: UpdateLocationDto, userId: string): Promise<AppointmentLocation> {
    return locationRepository.update(id, dto, userId);
  },

  async delete(id: string, userId: string): Promise<AppointmentLocation> {
    return locationRepository.delete(id, userId);
  },

  async restore(id: string, userId: string): Promise<AppointmentLocation> {
    return locationRepository.restore(id, userId);
  },
};
