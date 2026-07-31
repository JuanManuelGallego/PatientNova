import { prisma } from '../utils/prisma/prisma-client.js';
import { PatientNotFoundError } from '../utils/errors/errors.js';
import { MedicalRecordAlreadyExistsError } from './medical-record.errors.js';
import { medicalRecordRepository } from './medical-record.repository.js';
import { logger } from '../utils/api/logger.js';
import { auditLogService } from '../audit-log/audit-log.service.js';
import { buildAuditEntry, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './medical-record.schemas.js';
import { updateMedicalRecordSchema } from './medical-record.schemas.js';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const MEDICAL_RECORD_DIFF_FIELDS = schemaKeys(updateMedicalRecordSchema);

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
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: record.id,
      actionType: ActionType.CREATE,
      description: `Created medical record for patient ${dto.patientId}`,
      affectedFields: Object.keys(dto),
      fieldsAfter: dto as unknown as Record<string, unknown>,
    }));
    logger.info({ medicalRecordId: record.id, patientId: dto.patientId, userId }, 'Medical record created');
    return record;
  },

  async update(id: string, dto: UpdateMedicalRecordDto, userId: string) {
    const before = await medicalRecordRepository.findById(id, userId);
    const record = await medicalRecordRepository.update(id, dto, userId);
    const diff = computeDiff(before as unknown as Record<string, unknown>, record as unknown as Record<string, unknown>, MEDICAL_RECORD_DIFF_FIELDS);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: `Updated medical record ${id}`,
      ...diff,
    }));
    logger.info({ medicalRecordId: id, userId, fields: Object.keys(dto) }, 'Medical record updated');
    return record;
  },

  async softDelete(id: string, userId: string) {
    const before = await medicalRecordRepository.findById(id, userId);
    const record = await medicalRecordRepository.softDelete(id, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Deleted medical record ${id}`,
      fieldsBefore: { patientId: (before as Record<string, unknown>).patientId },
    }));
    logger.info({ medicalRecordId: id, userId }, 'Medical record deleted');
    return record;
  },

  async restore(id: string, userId: string) {
    const record = await medicalRecordRepository.restore(id, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: id,
      actionType: ActionType.RESTORE,
      description: `Restored medical record ${id}`,
      fieldsAfter: { patientId: (record as Record<string, unknown>).patientId },
    }));
    logger.info({ medicalRecordId: id, userId }, 'Medical record restored');
    return record;
  },

  async delete(id: string, userId: string) {
    const before = await medicalRecordRepository.findById(id, userId);
    const record = await medicalRecordRepository.delete(id, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Permanently deleted medical record ${id}`,
      fieldsBefore: { patientId: (before as Record<string, unknown>).patientId },
    }));
    logger.info({ medicalRecordId: id, userId }, 'Medical record permanently deleted');
    return record;
  },
};
