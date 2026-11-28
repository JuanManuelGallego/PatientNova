import { MAX_PATIENTS_PER_PROVIDER, patientRepository, type CreatePatientOptions } from './patient.repository.js';
import { PatientLimitReachedError } from './patient.errors.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import type { CreatePatientDto, NewPatientDto, UpdatePatientDto, ListPatientsQuery, PatientStatsQuery } from './patient.schemas.js';
import { updatePatientSchema } from './patient.schemas.js';
import type { Patient } from '../../generated/prisma/client.ts';
import type { Paginated } from '../utils/api/pagination.ts';
import { ActionType, Channel, EntityType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { resolvePatientTypeId } from '../patient-types/patient-type.service.js';
import { archiveRecordForTypeChange } from '../medical-records/record-snapshot.js';
import { lockPatientType } from '../medical-records/record-data.js';

type PatientWithRelations = Patient & {
  appointments: { id: string }[];
  reminders: { id: string }[];
};

// The type change goes into the same row, with the snapshot id (`changePatientType`).
const PATIENT_DIFF_FIELDS = [ ...schemaKeys(updatePatientSchema).filter((k) => k !== 'patientTypeId'), 'whatsappUnverified' ];

interface TypeChange {
  before: { patientTypeId: string };
  after: { patientTypeId: string; snapshotId: string | null };
  description: string;
}

async function changePatientType(tx: TransactionClient, patient: Patient, requestedTypeId: string, userId: string): Promise<TypeChange> {
  const nextTypeId = await resolvePatientTypeId(tx, userId, requestedTypeId);
  const [ oldType, nextType ] = await Promise.all([
    tx.patientType.findUniqueOrThrow({ where: { id: patient.patientTypeId }, select: { id: true, name: true, template: true } }),
    tx.patientType.findUniqueOrThrow({ where: { id: nextTypeId }, select: { name: true } }),
  ]);
  const snapshotId = await archiveRecordForTypeChange(tx, patient.id, oldType);
  return {
    before: { patientTypeId: patient.patientTypeId },
    after: { patientTypeId: nextTypeId, snapshotId },
    description: `Tipo de paciente de ${patient.name} ${patient.lastName} cambiado: ${oldType.name} → ${nextType.name}`,
  };
}

function withTypeChange(diff: ReturnType<typeof computeDiff>, change: TypeChange | null): ReturnType<typeof computeDiff> {
  if (!change) return diff;
  return {
    affectedFields: [ ...diff.affectedFields, 'patientTypeId' ],
    fieldsBefore: { ...diff.fieldsBefore, ...change.before },
    fieldsAfter: { ...diff.fieldsAfter, ...change.after },
  };
}

function endorsesWhatsapp(existing: Patient, dto: UpdatePatientDto): boolean {
  if (!existing.whatsappUnverified) return false;
  const numberChanged = dto.whatsappNumber !== undefined && (dto.whatsappNumber || null) !== existing.whatsappNumber;
  return numberChanged || dto.reminderChannel === Channel.WHATSAPP;
}

export async function createPatientWithin(
  tx: TransactionClient,
  dto: NewPatientDto,
  userId: string,
  opts: CreatePatientOptions = {},
): Promise<Patient> {
  await withProviderLock(tx, userId);
  if (await patientRepository.countActive(userId, tx) >= MAX_PATIENTS_PER_PROVIDER) {
    throw new PatientLimitReachedError(MAX_PATIENTS_PER_PROVIDER);
  }
  const typed: CreatePatientDto = { ...dto, patientTypeId: await resolvePatientTypeId(tx, userId, dto.patientTypeId) };
  const createdPatient = await patientRepository.create(typed, userId, tx, opts);
  await logAudit({
    entityType: EntityType.PATIENT,
    entityId: createdPatient.id,
    userId,
    actionType: ActionType.CREATE,
    description: `Paciente creado ${createdPatient.name} ${createdPatient.lastName}`,
    affectedFields: Object.keys(typed),
    fieldsAfter: typed as unknown as Record<string, unknown>,
    tx,
    required: true,
  });
  return createdPatient;
}

/** `description` overrides the default audit text, for callers that change a patient as part of another action. */
export async function updatePatientWithin(
  tx: TransactionClient,
  id: string,
  dto: UpdatePatientDto,
  userId: string,
  opts: { description?: string; endorseWhatsapp?: boolean } = {},
): Promise<Patient> {
  // A type change reads the current type under the lock, so a simultaneous change sees this one committed.
  if (dto.patientTypeId !== undefined) await lockPatientType(tx, id);
  const existingPatient = await patientRepository.findById(id, userId, tx);
  const typeChange = dto.patientTypeId !== undefined && dto.patientTypeId !== existingPatient.patientTypeId
    ? await changePatientType(tx, existingPatient, dto.patientTypeId, userId)
    : null;
  const updatedPatient = await patientRepository.update(
    id,
    dto,
    userId,
    tx,
    opts.endorseWhatsapp || endorsesWhatsapp(existingPatient, dto) ? { whatsappUnverified: false } : {},
  );
  const diff = computeDiff(existingPatient as unknown as Record<string, unknown>, updatedPatient as unknown as Record<string, unknown>, PATIENT_DIFF_FIELDS);
  await logAudit({
    entityType: EntityType.PATIENT,
    entityId: id,
    userId,
    actionType: ActionType.UPDATE,
    description: opts.description
      ?? (typeChange && diff.affectedFields.length === 0 ? typeChange.description : `Paciente actualizado ${updatedPatient.name} ${updatedPatient.lastName}`),
    ...withTypeChange(diff, typeChange),
    tx,
    required: true,
  });
  return updatedPatient;
}

/** Restores a soft-deleted patient under the provider lock, enforcing the patient limit. */
export async function restorePatientWithin(
  tx: TransactionClient,
  id: string,
  userId: string,
  opts: { description?: string } = {},
): Promise<Patient> {
  await withProviderLock(tx, userId);
  const restoredPatient = await patientRepository.restore(id, userId, tx);
  if (await patientRepository.countActive(userId, tx) > MAX_PATIENTS_PER_PROVIDER) {
    throw new PatientLimitReachedError(MAX_PATIENTS_PER_PROVIDER);
  }
  await logAudit({
    entityType: EntityType.PATIENT,
    entityId: id,
    userId,
    actionType: ActionType.RESTORE,
    description: opts.description ?? `Paciente restaurado ${restoredPatient.name} ${restoredPatient.lastName}`,
    affectedFields: ['isDeleted'],
    fieldsBefore: { isDeleted: true },
    fieldsAfter: { isDeleted: false },
    tx,
    required: true,
  });
  return restoredPatient;
}

export const patientService = {
  findById: patientRepository.findById.bind(patientRepository),

  async findByIdWithRelations(
    id: string,
    userId: string,
    opts?: { take?: number },
  ): Promise<PatientWithRelations> {
    return patientRepository.findByIdWithRelations(id, userId, opts);
  },

  async findMany(query: ListPatientsQuery, userId: string): Promise<Paginated<Patient>> {
    return patientRepository.findMany(query, userId);
  },

  async getStats(userId: string, query?: PatientStatsQuery) {
    return patientRepository.getStats(userId, query);
  },

  async create(dto: NewPatientDto, userId: string): Promise<Patient> {
    return prisma.$transaction((tx) => createPatientWithin(tx, dto, userId));
  },

  async update(id: string, dto: UpdatePatientDto, userId: string): Promise<Patient> {
    return prisma.$transaction((tx) => updatePatientWithin(tx, id, dto, userId));
  },

  async delete(id: string, userId: string): Promise<{ id: string }> {
    return prisma.$transaction(async (tx) => {
      const deletedPatient = await patientRepository.delete(id, userId, tx);
      await logAudit({
        entityType: EntityType.PATIENT,
        entityId: id,
        userId,
        actionType: ActionType.DELETE,
        description: `Paciente eliminado ${deletedPatient.name} ${deletedPatient.lastName}`,
        affectedFields: ['isDeleted'],
        fieldsBefore: { isDeleted: false },
        fieldsAfter: { isDeleted: true },
        tx,
        required: true,
      });
      return { id };
    });
  },

  async restore(id: string, userId: string): Promise<Patient> {
    return prisma.$transaction((tx) => restorePatientWithin(tx, id, userId));
  },

  async verifyOwnership(patientId: string, userId: string): Promise<void> {
    await patientRepository.findById(patientId, userId);
  },
};
