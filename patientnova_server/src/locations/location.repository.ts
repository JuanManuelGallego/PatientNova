import type { AppointmentLocation } from '../../generated/prisma/client.ts';
import { prisma } from '../prisma/prismaClient.js';
import type { CreateLocationDto, UpdateLocationDto, ListLocationsQuery } from './location.schemas.js';
import { LocationNotFoundError, LocationNameConflictError } from '../utils/errors.js';

export const locationRepository = {
  async create(dto: CreateLocationDto, userId: string): Promise<AppointmentLocation> {
    const existing = await prisma.appointmentLocation.findUnique({
      where: { userId_name: { userId, name: dto.name } },
    });
    if (existing) throw new LocationNameConflictError(dto.name);

    return prisma.appointmentLocation.create({
      data: {
        name: dto.name,
        address: dto.address ?? null,
        instructions: dto.instructions ?? null,
        color: dto.color ?? null,
        defaultPrice: dto.defaultPrice ?? null,
        isVirtual: dto.isVirtual ?? false,
        userId,
      },
    });
  },

  async findById(id: string, userId: string): Promise<AppointmentLocation> {
    const location = await prisma.appointmentLocation.findFirst({
      where: { id, userId },
    });
    if (!location) throw new LocationNotFoundError(id);
    return location;
  },

  async findMany(userId: string, query?: ListLocationsQuery): Promise<AppointmentLocation[]> {
    const includeDeleted = query?.includeDeleted ?? false;
    return prisma.appointmentLocation.findMany({
      where: { userId, ...(includeDeleted ? {} : { isDeleted: false }) },
      orderBy: { name: 'asc' },
    });
  },

  async update(id: string, dto: UpdateLocationDto, userId: string): Promise<AppointmentLocation> {
    await locationRepository.findById(id, userId);

    if (dto.name) {
      const conflict = await prisma.appointmentLocation.findFirst({
        where: { userId, name: dto.name, NOT: { id } },
      });
      if (conflict) throw new LocationNameConflictError(dto.name);
    }

    return prisma.appointmentLocation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.instructions !== undefined && { instructions: dto.instructions }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.defaultPrice !== undefined && { defaultPrice: dto.defaultPrice }),
        ...(dto.isVirtual !== undefined && { isVirtual: dto.isVirtual }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  },

  async delete(id: string, userId: string): Promise<AppointmentLocation> {
    await locationRepository.findById(id, userId);
    return prisma.appointmentLocation.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  },

  async restore(id: string, userId: string): Promise<AppointmentLocation> {
    await locationRepository.findById(id, userId);
    return prisma.appointmentLocation.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null },
    });
  },
};
