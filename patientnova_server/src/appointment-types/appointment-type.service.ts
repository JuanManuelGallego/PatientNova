import { appointmentTypeRepository } from './appointment-type.repository.js';
import type { CreateAppointmentTypeDto, UpdateAppointmentTypeDto } from './appointment-type.schemas.js';
import type { AppointmentType } from '../../generated/prisma/client.ts';

export const appointmentTypeService = {
  findById: appointmentTypeRepository.findById.bind(appointmentTypeRepository),
  findMany: appointmentTypeRepository.findMany.bind(appointmentTypeRepository),

  async create(dto: CreateAppointmentTypeDto, userId: string): Promise<AppointmentType> {
    return appointmentTypeRepository.create(dto, userId);
  },

  async update(id: string, dto: UpdateAppointmentTypeDto, userId: string): Promise<AppointmentType> {
    return appointmentTypeRepository.update(id, dto, userId);
  },

  async delete(id: string, userId: string): Promise<AppointmentType> {
    return appointmentTypeRepository.delete(id, userId);
  },

  async restore(id: string, userId: string): Promise<AppointmentType> {
    return appointmentTypeRepository.restore(id, userId);
  },
};
