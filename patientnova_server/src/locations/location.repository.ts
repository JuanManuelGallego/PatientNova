import type { AppointmentLocation } from '@prisma/client';
import { prisma } from '../prisma/prismaClient.js';
import type { CreateLocationDto, UpdateLocationDto } from './location.schemas.js';
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
        color: dto.color ?? null,
        bg: dto.bg ?? null,
        dot: dto.dot ?? null,
        icon: dto.icon ?? null,
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

  async findMany(userId: string): Promise<AppointmentLocation[]> {
    return prisma.appointmentLocation.findMany({
      where: { userId },
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
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.bg !== undefined && { bg: dto.bg }),
        ...(dto.dot !== undefined && { dot: dto.dot }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
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
      data: { isActive: false },
    });
  },
};
