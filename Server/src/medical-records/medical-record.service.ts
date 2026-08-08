import { medicalRecordRepository } from './medical-record.repository.js';
import { logger } from '../utils/api/logger.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './medical-record.schemas.js';
import { updateMedicalRecordSchema } from './medical-record.schemas.js';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';
import type { MedicalRecord } from '../../generated/prisma/client.ts';

const MEDICAL_RECORD_DIFF_FIELDS = schemaKeys(updateMedicalRecordSchema);

export const medicalRecordService = {
  findById: medicalRecordRepository.findById.bind(medicalRecordRepository),
  findByPatientId: medicalRecordRepository.findByPatientId.bind(medicalRecordRepository),
  findMany: medicalRecordRepository.findMany.bind(medicalRecordRepository),

  async create(dto: CreateMedicalRecordDto, userId: string) {
    const createdRecord = await medicalRecordRepository.create(dto, userId);
    await logAudit({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: createdRecord.id,
      actionType: ActionType.CREATE,
      description: `Historia clínica creada para el paciente ${dto.name}`,
      affectedFields: Object.keys(dto),
      fieldsAfter: dto as unknown as Record<string, unknown>,
    });
    return createdRecord;
  },

  async update(id: string, dto: UpdateMedicalRecordDto, userId: string) {
    const existingRecord = await medicalRecordRepository.findById(id, userId);
    const updatedRecord = await medicalRecordRepository.update(id, dto, userId);
    const diff = computeDiff(existingRecord as unknown as Record<string, unknown>, updatedRecord as unknown as Record<string, unknown>, MEDICAL_RECORD_DIFF_FIELDS);
    await logAudit({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: `Historia clínica de ${updatedRecord.name} actualizada`,
      ...diff,
    });
    logger.info({ medicalRecordId: id, userId, fields: Object.keys(dto) }, 'Medical record updated');
    return updatedRecord;
  },

  async softDelete(id: string, userId: string): Promise<{ id: string }> {
    const deleted = await medicalRecordRepository.softDelete(id, userId);
    await logAudit({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Historia clínica de ${deleted.name} eliminada`,
      affectedFields: [ 'isDeleted' ],
      fieldsBefore: { isDeleted: false },
      fieldsAfter: { isDeleted: true },
    });
    return { id };
  },

  async restore(id: string, userId: string): Promise<MedicalRecord> {
    const restoredRecord = await medicalRecordRepository.restore(id, userId);
    await logAudit({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: id,
      actionType: ActionType.RESTORE,
      description: `Historia clínica de ${restoredRecord.name} restaurada`,
      affectedFields: [ 'isDeleted' ],
      fieldsBefore: { isDeleted: true },
      fieldsAfter: { isDeleted: false },
    });
    return restoredRecord;
  },

  async delete(id: string, userId: string): Promise<{ id: string }> {
    await medicalRecordRepository.delete(id, userId);
    await logAudit({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Historia clínica eliminada permanentemente ${id}`,
      affectedFields: [],
    });
    return { id };
  },
};
