import type { AppointmentType } from '@prisma/client';
import { prisma } from '../prisma/prismaClient.js';
import type { CreateAppointmentTypeDto, UpdateAppointmentTypeDto } from './appointment-type.schemas.js';
import { AppointmentTypeNotFoundError, AppointmentTypeNameConflictError } from '../utils/errors.js';

export const appointmentTypeRepository = {
  async create(dto: CreateAppointmentTypeDto, userId: string): Promise<AppointmentType> {
    const existing = await prisma.appointmentType.findUnique({
      where: { userId_name: { userId, name: dto.name } },
    });
    if (existing) throw new AppointmentTypeNameConflictError(dto.name);

    return prisma.appointmentType.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        defaultDuration: dto.defaultDuration ?? 60,
        defaultPrice: dto.defaultPrice ?? null,
        color: dto.color ?? null,
        icon: dto.icon ?? null,
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

  async findMany(userId: string): Promise<AppointmentType[]> {
    return prisma.appointmentType.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  },

  async update(id: string, dto: UpdateAppointmentTypeDto, userId: string): Promise<AppointmentType> {
    await appointmentTypeRepository.findById(id, userId);

    if (dto.name) {
      const conflict = await prisma.appointmentType.findFirst({
        where: { userId, name: dto.name, NOT: { id } },
      });
      if (conflict) throw new AppointmentTypeNameConflictError(dto.name);
    }

    return prisma.appointmentType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.defaultDuration !== undefined && { defaultDuration: dto.defaultDuration }),
        ...(dto.defaultPrice !== undefined && { defaultPrice: dto.defaultPrice }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  },

  async delete(id: string, userId: string): Promise<AppointmentType> {
    await appointmentTypeRepository.findById(id, userId);
    return prisma.appointmentType.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
