import { patientRepository } from './patient.repository.js';
import { withAudit } from '../audit-log/with-audit.js';
import type { CreatePatientDto, UpdatePatientDto, ListPatientsQuery, PatientStatsQuery } from './patient.schemas.js';
import { updatePatientSchema } from './patient.schemas.js';
import type { Patient } from '../../generated/prisma/client.ts';
import type { Paginated } from '../utils/api/pagination.ts';
import { EntityType } from '../../generated/prisma/enums.ts';
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

  create: withAudit(
    (dto: CreatePatientDto, userId: string) => patientRepository.create(dto, userId),
    {
      entityType: EntityType.PATIENT,
      action: 'CREATE',
      description: (p) => `Created patient ${p.name} ${p.lastName}`,
      affectedFields: (_p, dto) => Object.keys(dto as Record<string, unknown>),
      fieldsAfter: (_p, dto) => dto as unknown as Record<string, unknown>,
    },
  ),

  update: withAudit(
    (id: string, dto: UpdatePatientDto, userId: string) => patientRepository.update(id, dto, userId),
    {
      entityType: EntityType.PATIENT,
      action: 'UPDATE',
      description: (p) => `Updated patient ${p.name}`,
      getBefore: (id, _dto, userId) =>
        patientRepository.findById(id, userId as string) as Promise<Record<string, unknown>>,
      diffFields: PATIENT_DIFF_FIELDS,
    },
  ),

  delete: withAudit(
    (id: string, userId: string) => patientRepository.delete(id, userId),
    {
      entityType: EntityType.PATIENT,
      action: 'DELETE',
      description: (p) => `Deleted patient ${p.name} ${p.lastName}`,
      getBefore: (id, userId) =>
        patientRepository.findById(id, userId as string) as Promise<Record<string, unknown>>,
      fieldsBefore: (before) => ({
        name: before.name,
        lastName: before.lastName,
        email: before.email,
      }),
    },
  ),

  restore: withAudit(
    (id: string, userId: string) => patientRepository.restore(id, userId),
    {
      entityType: EntityType.PATIENT,
      action: 'RESTORE',
      description: (p) => `Restored patient ${p.name} ${p.lastName}`,
      fieldsAfter: (p) => ({
        name: p.name,
        lastName: p.lastName,
        email: p.email,
      }),
    },
  ),

  async verifyOwnership(patientId: string, userId: string): Promise<void> {
    await patientRepository.findById(patientId, userId);
  },
};
