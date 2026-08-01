import { patientRepository } from './patient.repository.js';
import type { CreatePatientDto, UpdatePatientDto, ListPatientsQuery, PatientStatsQuery } from './patient.schemas.js';
import { updatePatientSchema } from './patient.schemas.js';
import type { Patient } from '../../generated/prisma/client.ts';
import type { Paginated } from '../utils/api/pagination.ts';
import { ActionType, EntityType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';

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
    const createdPatient = await patientRepository.create(dto, userId);
    await logAudit({
      entityType: EntityType.PATIENT,
      entityId: createdPatient.id,
      actionType: ActionType.CREATE,
      description: `Created patient ${createdPatient.name} ${createdPatient.lastName}`,
      affectedFields: Object.keys(dto),
      fieldsAfter: dto as unknown as Record<string, unknown>,
    });
    return createdPatient;
  },

  async update(id: string, dto: UpdatePatientDto, userId: string): Promise<Patient> {
    const existingPatient = await patientRepository.findById(id, userId);
    const updatedPatient = await patientRepository.update(id, dto, userId);
    const diff = computeDiff(existingPatient as unknown as Record<string, unknown>, updatedPatient as unknown as Record<string, unknown>, PATIENT_DIFF_FIELDS);
    await logAudit({
      entityType: EntityType.PATIENT,
      entityId: id,
      actionType: ActionType.UPDATE,
      description: `Updated patient ${updatedPatient.name} ${updatedPatient.lastName}`,
      ...diff,
    });
    return updatedPatient;
  },

  async delete(id: string, userId: string): Promise<{ id: string }> {
    const deletedPatient = await patientRepository.delete(id, userId);
    await logAudit({
      entityType: EntityType.PATIENT,
      entityId: id,
      actionType: ActionType.DELETE,
      description: `Deleted patient ${deletedPatient.name} ${deletedPatient.lastName}`,
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: false },
      fieldsAfter: { isDeleted: true },
    });
    return { id };
  },

  async restore(id: string, userId: string): Promise<Patient> {
    const restoredPatient = await patientRepository.restore(id, userId);
    await logAudit({
      entityType: EntityType.PATIENT,
      entityId: id,
      actionType: ActionType.RESTORE,
      description: `Restored patient ${restoredPatient.name} ${restoredPatient.lastName}`,
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: true },
      fieldsAfter: { isDeleted: false },
    });
    return restoredPatient;
  },

  async verifyOwnership(patientId: string, userId: string): Promise<void> {
    await patientRepository.findById(patientId, userId);
  },
};
