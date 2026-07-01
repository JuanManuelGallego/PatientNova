import { prisma } from '../prisma/prismaClient.js';
import { PatientNotFoundError, MedicalRecordAlreadyExistsError } from '../utils/errors.js';
import { medicalRecordRepository } from './medical-record.repository.js';
import type { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './medical-record.schemas.js';

export const medicalRecordService = {
  findById: medicalRecordRepository.findById.bind(medicalRecordRepository),
  findByPatientId: medicalRecordRepository.findByPatientId.bind(medicalRecordRepository),
  findMany: medicalRecordRepository.findMany.bind(medicalRecordRepository),

  async create(dto: CreateMedicalRecordDto, userId: string) {
    // Validate patient exists and belongs to user
    const patient = await prisma.patient.findFirst({
      where: { id: dto.patientId, userId },
      include: { medicalRecord: true },
    });
    if (!patient) throw new PatientNotFoundError(dto.patientId);

    // Validate no existing medical record for this patient
    if (patient.medicalRecord) throw new MedicalRecordAlreadyExistsError(dto.patientId);

    return medicalRecordRepository.create(dto, userId);
  },

  async update(id: string, dto: UpdateMedicalRecordDto, userId: string) {
    return medicalRecordRepository.update(id, dto, userId);
  },

  async softDelete(id: string, userId: string) {
    return medicalRecordRepository.softDelete(id, userId);
  },

  async restore(id: string, userId: string) {
    return medicalRecordRepository.restore(id, userId);
  },

  async delete(id: string, userId: string) {
    return medicalRecordRepository.delete(id, userId);
  },
};
