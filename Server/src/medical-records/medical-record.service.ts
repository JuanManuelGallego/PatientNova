import { prisma } from '../utils/prisma/prisma-client.js';
import { PatientNotFoundError } from '../utils/errors/errors.js';
import { MedicalRecordAlreadyExistsError } from './medical-record.errors.js';
import { medicalRecordRepository } from './medical-record.repository.js';
import { logger } from '../utils/api/logger.js';
import type { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './medical-record.schemas.js';

export const medicalRecordService = {
  findById: medicalRecordRepository.findById.bind(medicalRecordRepository),
  findByPatientId: medicalRecordRepository.findByPatientId.bind(medicalRecordRepository),
  findMany: medicalRecordRepository.findMany.bind(medicalRecordRepository),

  async create(dto: CreateMedicalRecordDto, userId: string) {
    const patient = await prisma.patient.findFirst({
      where: { id: dto.patientId, userId },
      include: { medicalRecord: true },
    });
    if (!patient) throw new PatientNotFoundError(dto.patientId);
    if (patient.medicalRecord) throw new MedicalRecordAlreadyExistsError(dto.patientId);

    const record = await medicalRecordRepository.create(dto, userId);
    logger.info({ medicalRecordId: record.id, patientId: dto.patientId, userId }, 'Medical record created');
    return record;
  },

  async update(id: string, dto: UpdateMedicalRecordDto, userId: string) {
    const record = await medicalRecordRepository.update(id, dto, userId);
    logger.info({ medicalRecordId: id, userId, fields: Object.keys(dto) }, 'Medical record updated');
    return record;
  },

  async softDelete(id: string, userId: string) {
    const record = await medicalRecordRepository.softDelete(id, userId);
    logger.info({ medicalRecordId: id, userId }, 'Medical record deleted');
    return record;
  },

  async restore(id: string, userId: string) {
    const record = await medicalRecordRepository.restore(id, userId);
    logger.info({ medicalRecordId: id, userId }, 'Medical record restored');
    return record;
  },

  async delete(id: string, userId: string) {
    const record = await medicalRecordRepository.delete(id, userId);
    logger.info({ medicalRecordId: id, userId }, 'Medical record permanently deleted');
    return record;
  },
};
