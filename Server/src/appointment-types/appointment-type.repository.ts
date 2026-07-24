import { prisma } from '../utils/prisma/prisma-client.js';
import type { CreateAppointmentTypeDto, UpdateAppointmentTypeDto, ListAppointmentTypesQuery } from './appointment-type.schemas.js';
import { AppointmentTypeNotFoundError, AppointmentTypeNameConflictError } from './appointment-type.errors.js';
import { type AppointmentType } from '../../generated/prisma/client.ts';
import { buildUpdateData } from '../utils/prisma/build-update-data.js';
import { softDelete, restore } from '../utils/prisma/softDelete.js';
import { assertUnique } from '../utils/validation/assertUnique.js';

export const appointmentTypeRepository = {
  async create(dto: CreateAppointmentTypeDto, userId: string): Promise<AppointmentType> {
    await assertUnique(
      () => prisma.appointmentType.findUnique({
        where: { userId_name: { userId, name: dto.name } },
      }),
      AppointmentTypeNameConflictError,
      dto.name,
    );

    return prisma.appointmentType.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        defaultDuration: dto.defaultDuration ?? 60,
        defaultPrice: dto.defaultPrice ?? null,
        color: dto.color ?? null,
        userId,
      },
    });
  },

  async findById(id: string, userId: string): Promise<AppointmentType> {
    const type = await prisma.appointmentType.findFirst({
      where: { id, userId },
    });
    if (!type) throw new AppointmentTypeNotFoundError(id);
    return type;
  },

  async findMany(userId: string, query?: ListAppointmentTypesQuery): Promise<AppointmentType[]> {
    const includeDeleted = query?.includeDeleted ?? false;
    return prisma.appointmentType.findMany({
      where: { userId, ...(includeDeleted ? {} : { isDeleted: false }) },
      orderBy: { name: 'asc' },
    });
  },

  async update(id: string, dto: UpdateAppointmentTypeDto, userId: string): Promise<AppointmentType> {
    await appointmentTypeRepository.findById(id, userId);

    if (dto.name) {
      const name = dto.name;
      await assertUnique(
        () => prisma.appointmentType.findFirst({
          where: { userId, name, NOT: { id } },
        }),
        AppointmentTypeNameConflictError,
        name,
      );
    }

    const data = buildUpdateData(
      dto,
      [ 'name', 'description', 'defaultDuration', 'defaultPrice', 'color', 'isActive' ],
    );

    return prisma.appointmentType.update({
      where: { id },
      data,
    });
  },

  async delete(id: string, userId: string): Promise<AppointmentType> {
    await appointmentTypeRepository.findById(id, userId);
    return softDelete(prisma.appointmentType, id, userId) as Promise<AppointmentType>;
  },

  async restore(id: string, userId: string): Promise<AppointmentType> {
    await appointmentTypeRepository.findById(id, userId);
    return restore(prisma.appointmentType, id, userId) as Promise<AppointmentType>;
  },
};
