import type { AppointmentLocation } from '../../generated/prisma/client.ts';
import { prisma } from '../prisma/prismaClient.js';
import type { CreateLocationDto, UpdateLocationDto, ListLocationsQuery } from './location.schemas.js';
import { LocationNotFoundError, LocationNameConflictError } from '../utils/errors.js';
import { buildUpdateData } from '../utils/buildUpdateData.js';
import { softDelete, restore } from '../utils/softDelete.js';
import { assertUnique } from '../utils/assertUnique.js';

export const locationRepository = {
  async create(dto: CreateLocationDto, userId: string): Promise<AppointmentLocation> {
    await assertUnique(
      () => prisma.appointmentLocation.findUnique({
        where: { userId_name: { userId, name: dto.name } },
      }),
      LocationNameConflictError,
      dto.name,
    );

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
      const name = dto.name;
      await assertUnique(
        () => prisma.appointmentLocation.findFirst({
          where: { userId, name, NOT: { id } },
        }),
        LocationNameConflictError,
        name,
      );
    }

    const data = buildUpdateData(
      dto,
      [ 'name', 'address', 'instructions', 'color', 'defaultPrice', 'isVirtual', 'isActive' ],
    );

    return prisma.appointmentLocation.update({
      where: { id },
      data,
    });
  },

  async delete(id: string, userId: string): Promise<AppointmentLocation> {
    await locationRepository.findById(id, userId);
    return softDelete(prisma.appointmentLocation, id, userId);
  },

  async restore(id: string, userId: string): Promise<AppointmentLocation> {
    await locationRepository.findById(id, userId);
    return restore(prisma.appointmentLocation, id, userId);
  },
};
