import { medicalRecordRepository } from './medical-record.repository.js';
import { logger } from '../utils/api/logger.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './medical-record.schemas.js';
import { updateMedicalRecordSchema } from './medical-record.schemas.js';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';
import { prisma } from '../utils/prisma/prisma-client.js';
import { dataDiff, lockRecord } from './record-data.js';
import type { MedicalRecordDto } from './medical-record.dto.js';

/** Identity and relation fields; the payload is audited key by key through `dataDiff`. */
const MEDICAL_RECORD_DIFF_FIELDS = schemaKeys(updateMedicalRecordSchema).filter((k) => k !== 'data');

export const medicalRecordService = {
  findById: medicalRecordRepository.findById.bind(medicalRecordRepository),
  findByPatientId: medicalRecordRepository.findByPatientId.bind(medicalRecordRepository),
  findMany: medicalRecordRepository.findMany.bind(medicalRecordRepository),

  async create(dto: CreateMedicalRecordDto, userId: string): Promise<MedicalRecordDto> {
    return prisma.$transaction(async (tx) => {
      const created = await medicalRecordRepository.create(dto, userId, tx);
      const sent = [ 'patientId', ...MEDICAL_RECORD_DIFF_FIELDS ].filter((k) => (dto as Record<string, unknown>)[ k ] !== undefined);
      const data = dataDiff({}, created.data);
      await logAudit({
        entityType: EntityType.MEDICAL_RECORD,
        entityId: created.id,
        userId,
        actionType: ActionType.CREATE,
        description: `Historia clínica creada para el paciente ${dto.name}`,
        affectedFields: [ ...sent, ...data.affectedFields ],
        fieldsAfter: { ...Object.fromEntries(sent.map((k) => [ k, (dto as Record<string, unknown>)[ k ] ])), ...data.fieldsAfter },
        tx,
        required: true,
      });
      return created;
    });
  },

  async update(id: string, dto: UpdateMedicalRecordDto, userId: string): Promise<MedicalRecordDto> {
    const updated = await prisma.$transaction(async (tx) => {
      await lockRecord(tx, id);
      const before = await medicalRecordRepository.findById(id, userId, tx);
      const after = await medicalRecordRepository.update(id, dto, userId, tx);
      const fields = computeDiff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, MEDICAL_RECORD_DIFF_FIELDS);
      const data = dataDiff(before.data, after.data);
      const affectedFields = [ ...fields.affectedFields, ...data.affectedFields ];
      const changed = affectedFields.length > 0;
      await logAudit({
        entityType: EntityType.MEDICAL_RECORD,
        entityId: id,
        userId,
        actionType: ActionType.UPDATE,
        description: `Historia clínica de ${after.name} actualizada`,
        affectedFields,
        fieldsBefore: changed ? { ...fields.fieldsBefore, ...data.fieldsBefore } : null,
        fieldsAfter: changed ? { ...fields.fieldsAfter, ...data.fieldsAfter } : null,
        tx,
        required: true,
      });
      return after;
    });
    logger.info({ medicalRecordId: id, userId, fields: Object.keys(dto) }, 'Medical record updated');
    return updated;
  },

  async delete(id: string, userId: string): Promise<{ id: string }> {
    const deleted = await medicalRecordRepository.delete(id, userId);
    await logAudit({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: id,
      userId,
      actionType: ActionType.DELETE,
      description: `Historia clínica de ${deleted.name} eliminada`,
      affectedFields: [ 'isDeleted' ],
      fieldsBefore: { isDeleted: false },
      fieldsAfter: { isDeleted: true },
    });
    return { id };
  },

  async restore(id: string, userId: string): Promise<MedicalRecordDto> {
    const restoredRecord = await medicalRecordRepository.restore(id, userId);
    await logAudit({
      entityType: EntityType.MEDICAL_RECORD,
      entityId: id,
      userId,
      actionType: ActionType.RESTORE,
      description: `Historia clínica de ${restoredRecord.name} restaurada`,
      affectedFields: [ 'isDeleted' ],
      fieldsBefore: { isDeleted: true },
      fieldsAfter: { isDeleted: false },
    });
    return restoredRecord;
  },
};
