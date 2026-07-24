import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { medicalRecordRepository } from '../../../src/medical-records/medical-record.repository.js';
import { createTestUser, createTestPatient } from '../helpers.js';
import { PatientNotFoundError } from '../../../src/utils/errors/errors.js';
import { MedicalRecordAlreadyExistsError, MedicalRecordNotFoundError } from '../../../src/medical-records/medical-record.errors.js';
import { SubsystemType, RelationshipStatus, Relationship } from '../../../generated/prisma/client.ts';

let userId: string;
let patientId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
});

function baseDto(overrides: Record<string, unknown> = {}) {
  return {
    patientId,
    name: 'Record Name',
    consultationReason: 'Initial consult',
    familyMembers: [
      { name: 'Mom', relationship: Relationship.MOTHER, relation: 'mother' },
    ],
    evolutionNotes: [{ date: new Date().toISOString(), text: 'First note' }],
    subsystemRelations: [
      { subsystem: SubsystemType.PARENTAL, status: RelationshipStatus.FUNCIONAL, observation: 'ok' },
    ],
    ...overrides,
  };
}

describe('medicalRecordRepository (integration)', () => {
  it('creates a medical record with nested relations', async () => {
    const created = await medicalRecordRepository.create(baseDto(), userId);
    expect(created.id).toBeTruthy();
    expect(created.patientId).toBe(patientId);
    expect(created.familyMembers).toHaveLength(1);
    expect(created.evolutionNotes).toHaveLength(1);
    expect(created.subsystemRelations).toHaveLength(1);
  });

  it('enforces one-to-one relationship with the patient', async () => {
    await medicalRecordRepository.create(baseDto(), userId);
    await expect(medicalRecordRepository.create(baseDto(), userId))
      .rejects.toThrow(MedicalRecordAlreadyExistsError);
  });

  it('throws PatientNotFoundError for an unknown patient', async () => {
    await expect(
      medicalRecordRepository.create({ ...baseDto(), patientId: '00000000-0000-0000-0000-000000000000' }, userId),
    ).rejects.toThrow(PatientNotFoundError);
  });

  it('finds a record by patient id', async () => {
    const created = await medicalRecordRepository.create(baseDto(), userId);
    const found = await medicalRecordRepository.findByPatientId(patientId, userId);
    expect(found.id).toBe(created.id);
  });

  it('replaces nested relations atomically on update', async () => {
    const created = await medicalRecordRepository.create(baseDto(), userId);

    const updated = await medicalRecordRepository.update(
      created.id,
      {
        familyMembers: [{ name: 'Dad', relationship: Relationship.FATHER, relation: 'father' }],
        evolutionNotes: [{ date: new Date().toISOString(), text: 'Second note' }],
        subsystemRelations: [],
      },
      userId,
    );

    expect(updated.familyMembers).toHaveLength(1);
    expect(updated.familyMembers[0]?.name).toBe('Dad');
    expect(updated.evolutionNotes).toHaveLength(1);
    expect(updated.evolutionNotes[0]?.text).toBe('Second note');
    expect(updated.subsystemRelations).toHaveLength(0);
  });

  it('scopes reads to the owning user', async () => {
    const created = await medicalRecordRepository.create(baseDto(), userId);
    const other = await createTestUser();

    await expect(medicalRecordRepository.findByPatientId(patientId, other.id))
      .rejects.toThrow(MedicalRecordNotFoundError);

    // Underlying row still exists for the owner
    const ownerFound = await medicalRecordRepository.findById(created.id, userId);
    expect(ownerFound.id).toBe(created.id);
  });

  it('soft-deletes and restores a record', async () => {
    const created = await medicalRecordRepository.create(baseDto(), userId);
    await medicalRecordRepository.softDelete(created.id, userId);

    const raw = await prisma.medicalRecord.findUnique({ where: { id: created.id } });
    expect(raw!.isDeleted).toBe(true);

    await medicalRecordRepository.restore(created.id, userId);
    const rawRestored = await prisma.medicalRecord.findUnique({ where: { id: created.id } });
    expect(rawRestored!.isDeleted).toBe(false);
  });

  it('hard-deletes a record', async () => {
    const created = await medicalRecordRepository.create(baseDto(), userId);
    await medicalRecordRepository.delete(created.id, userId);

    await expect(medicalRecordRepository.findById(created.id, userId))
      .rejects.toThrow(MedicalRecordNotFoundError);
  });

  it('findMany lists records and supports search by name', async () => {
    await medicalRecordRepository.create(baseDto({ name: 'Searchable Record' }), userId);

    const otherPatient = await createTestPatient(userId);
    await medicalRecordRepository.create(
      { ...baseDto(), patientId: otherPatient.id, name: 'Other Record' },
      userId,
    );

    const all = await medicalRecordRepository.findMany(
      { page: 1, pageSize: 20, orderBy: 'createdAt', order: 'desc', includeDeleted: false, search: undefined },
      userId,
    );
    expect(all.total).toBe(2);

    const found = await medicalRecordRepository.findMany(
      { page: 1, pageSize: 20, orderBy: 'createdAt', order: 'desc', includeDeleted: false, search: 'Searchable' },
      userId,
    );
    expect(found.total).toBe(1);
    expect(found.data[0]!.name).toBe('Searchable Record');
  });
});
