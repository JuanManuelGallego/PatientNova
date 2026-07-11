import { appointmentTypeRepository } from './appointment-type.repository.js';
import { logger } from '../utils/logger.js';
import type { CreateAppointmentTypeDto, UpdateAppointmentTypeDto } from './appointment-type.schemas.js';
import type { AppointmentType } from '../../generated/prisma/client.ts';

export const appointmentTypeService = {
  findById: appointmentTypeRepository.findById.bind(appointmentTypeRepository),
  findMany: appointmentTypeRepository.findMany.bind(appointmentTypeRepository),

  async create(dto: CreateAppointmentTypeDto, userId: string): Promise<AppointmentType> {
    const type = await appointmentTypeRepository.create(dto, userId);
    logger.info({ appointmentTypeId: type.id, userId, name: type.name }, 'Appointment type created');
    return type;
  },

  async update(id: string, dto: UpdateAppointmentTypeDto, userId: string): Promise<AppointmentType> {
    const type = await appointmentTypeRepository.update(id, dto, userId);
    logger.info({ appointmentTypeId: id, userId, fields: Object.keys(dto) }, 'Appointment type updated');
    return type;
  },

  async delete(id: string, userId: string): Promise<AppointmentType> {
    const type = await appointmentTypeRepository.delete(id, userId);
    logger.info({ appointmentTypeId: id, userId }, 'Appointment type deleted');
    return type;
  },

  async restore(id: string, userId: string): Promise<AppointmentType> {
    const type = await appointmentTypeRepository.restore(id, userId);
    logger.info({ appointmentTypeId: id, userId }, 'Appointment type restored');
    return type;
  },
};
