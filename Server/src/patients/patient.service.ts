import { patientRepository } from './patient.repository.js';
import { logger } from '../utils/logger.js';
import type { CreatePatientDto, UpdatePatientDto, ListPatientsQuery, PatientStatsQuery } from './patient.schemas.js';
import type { Patient } from '../../generated/prisma/client.ts';
import type { Paginated } from '../utils/pagination.ts';

type PatientWithRelations = Patient & {
  appointments: { id: string }[];
  reminders: { id: string }[];
};

export const patientService = {
  findById: patientRepository.findById.bind(patientRepository),

  async findByIdWithRelations(id: string, userId: string): Promise<PatientWithRelations> {
    return patientRepository.findByIdWithRelations(id, userId);
  },

  async findMany(query: ListPatientsQuery, userId: string): Promise<Paginated<Patient>> {
    return patientRepository.findMany(query, userId);
  },

  async getStats(userId: string, query?: PatientStatsQuery) {
    return patientRepository.getStats(userId, query);
  },

  async create(dto: CreatePatientDto, userId: string): Promise<Patient> {
    const patient = await patientRepository.create(dto, userId);
    logger.info({ patientId: patient.id, userId }, 'Patient created');
    return patient;
  },

  async update(id: string, dto: UpdatePatientDto, userId: string): Promise<Patient> {
    const patient = await patientRepository.update(id, dto, userId);
    logger.info({ patientId: id, userId, fields: Object.keys(dto) }, 'Patient updated');
    return patient;
  },

  async delete(id: string, userId: string): Promise<Patient> {
    const patient = await patientRepository.delete(id, userId);
    logger.info({ patientId: id, userId }, 'Patient deleted');
    return patient;
  },

  async restore(id: string, userId: string): Promise<Patient> {
    const patient = await patientRepository.restore(id, userId);
    logger.info({ patientId: id, userId }, 'Patient restored');
    return patient;
  },

  async verifyOwnership(patientId: string, userId: string): Promise<void> {
    await patientRepository.findById(patientId, userId);
  },
};
