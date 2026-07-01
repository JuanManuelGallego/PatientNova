import { patientRepository } from './patient.repository.js';
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
    return patientRepository.create(dto, userId);
  },

  async update(id: string, dto: UpdatePatientDto, userId: string): Promise<Patient> {
    return patientRepository.update(id, dto, userId);
  },

  async delete(id: string, userId: string): Promise<Patient> {
    return patientRepository.delete(id, userId);
  },

  async restore(id: string, userId: string): Promise<Patient> {
    return patientRepository.restore(id, userId);
  },

  /**
   * Asserts that a patient exists and belongs to the given user.
   */
  async verifyOwnership(patientId: string, userId: string): Promise<void> {
    await patientRepository.findById(patientId, userId);
  },
};
