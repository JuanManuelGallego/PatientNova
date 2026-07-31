import { patientRepository } from './patient.repository.js';
import { logger } from '../utils/api/logger.js';
import { auditLogService } from '../audit-log/audit-log.service.js';
import { buildAuditEntry, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreatePatientDto, UpdatePatientDto, ListPatientsQuery, PatientStatsQuery } from './patient.schemas.js';
import { updatePatientSchema } from './patient.schemas.js';
import type { Patient } from '../../generated/prisma/client.ts';
import type { Paginated } from '../utils/api/pagination.ts';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';

type PatientWithRelations = Patient & {
  appointments: { id: string }[];
  reminders: { id: string }[];
};

const PATIENT_DIFF_FIELDS = schemaKeys(updatePatientSchema);

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
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.PATIENT,
      entityId: patient.id,
      actionType: ActionType.CREATE,
      description: `Created patient ${patient.name} ${patient.lastName}`,
      affectedFields: Object.keys(dto),
      fieldsAfter: dto as Record<string, unknown>,
    }));
    logger.info({ patientId: patient.id, userId }, 'Patient created');
    return patient;
  },

  async update(id: string, dto: UpdatePatientDto, userId: string): Promise<Patient> {
    const before = await patientRepository.findById(id, userId);
    const patient = await patientRepository.update(id, dto, userId);
    const diff = computeDiff(before as unknown as Record<string, unknown>, patient as unknown as Record<string, unknown>, PATIENT_DIFF_FIELDS);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.PATIENT,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: `Updated patient ${patient.name}`,
      ...diff,
    }));
    logger.info({ patientId: id, userId, fields: Object.keys(dto) }, 'Patient updated');
    return patient;
  },

  async delete(id: string, userId: string): Promise<Patient> {
    const before = await patientRepository.findById(id, userId);
    const patient = await patientRepository.delete(id, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.PATIENT,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Deleted patient ${before.name} ${before.lastName}`,
      fieldsBefore: { name: before.name, lastName: before.lastName, email: before.email },
    }));
    logger.info({ patientId: id, userId }, 'Patient deleted');
    return patient;
  },

  async restore(id: string, userId: string): Promise<Patient> {
    const patient = await patientRepository.restore(id, userId);
    await auditLogService.create(buildAuditEntry({
      entityType: EntityType.PATIENT,
      entityId: id,
      actionType: ActionType.RESTORE,
      description: `Restored patient ${patient.name} ${patient.lastName}`,
      fieldsAfter: { name: patient.name, lastName: patient.lastName, email: patient.email },
    }));
    logger.info({ patientId: id, userId }, 'Patient restored');
    return patient;
  },

  async verifyOwnership(patientId: string, userId: string): Promise<void> {
    await patientRepository.findById(patientId, userId);
  },
};
