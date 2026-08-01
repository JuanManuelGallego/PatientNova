import { medicalRecordRepository } from './medical-record.repository.js';
import { logger } from '../utils/api/logger.js';
import { withAudit } from '../audit-log/with-audit.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './medical-record.schemas.js';
import { updateMedicalRecordSchema } from './medical-record.schemas.js';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const MEDICAL_RECORD_DIFF_FIELDS = schemaKeys(updateMedicalRecordSchema);

export const medicalRecordService = {
  findById: medicalRecordRepository.findById.bind(medicalRecordRepository),
  findByPatientId: medicalRecordRepository.findByPatientId.bind(medicalRecordRepository),
  findMany: medicalRecordRepository.findMany.bind(medicalRecordRepository),

  create: withAudit(
    (dto: CreateMedicalRecordDto, userId: string) => medicalRecordRepository.create(dto, userId),
    {
      entityType: EntityType.MEDICAL_RECORD,
      action: ActionType.CREATE,
      description: (_r, dto) => `Created medical record for patient ${(dto as CreateMedicalRecordDto).patientId}`,
      affectedFields: (_r, dto) => Object.keys(dto as Record<string, unknown>),
      fieldsAfter: (_r, dto) => dto as unknown as Record<string, unknown>,
    },
  ),

  async update(id: string, dto: UpdateMedicalRecordDto, userId: string) {
    const before = await medicalRecordRepository.findById(id, userId);
    const record = await medicalRecordRepository.update(id, dto, userId);
    const diff = computeDiff(before as unknown as Record<string, unknown>, record as unknown as Record<string, unknown>, MEDICAL_RECORD_DIFF_FIELDS);
    await logAudit({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: `Updated medical record ${id}`,
      ...diff,
    });
    logger.info({ medicalRecordId: id, userId, fields: Object.keys(dto) }, 'Medical record updated');
    return record;
  },

  softDelete: withAudit(
    (id: string, userId: string) => medicalRecordRepository.softDelete(id, userId) as Promise<{ id: string }>,
    {
      entityType: EntityType.MEDICAL_RECORD,
      action: ActionType.DELETE,
      description: (_r, id) => `Deleted medical record ${id}`,
      getBefore: (id, userId) =>
        medicalRecordRepository.findById(id, userId as string) as Promise<Record<string, unknown>>,
      affectedFields: () => ['isDeleted'],
      fieldsBefore: () => ({
        isDeleted: false,
      }),
      fieldsAfter: () => ({
        isDeleted: true,
      }),
    },
  ),

  restore: withAudit(
    (id: string, userId: string) => medicalRecordRepository.restore(id, userId) as Promise<{ id: string; patientId: unknown }>,
    {
      entityType: EntityType.MEDICAL_RECORD,
      action: ActionType.RESTORE,
      description: (_r, id) => `Restored medical record ${id}`,
      affectedFields: () => ['isDeleted'],
      fieldsBefore: () => ({
        isDeleted: true,
      }),
      fieldsAfter: () => ({
        isDeleted: false,
      }),
    },
  ),

  delete: withAudit(
    (id: string, userId: string) => medicalRecordRepository.delete(id, userId) as Promise<{ id: string }>,
    {
      entityType: EntityType.MEDICAL_RECORD,
      action: ActionType.DELETE,
      description: (_r, id) => `Permanently deleted medical record ${id}`,
    },
  ),
};
