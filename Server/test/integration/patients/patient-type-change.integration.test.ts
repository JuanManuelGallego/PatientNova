import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { patientRouter } from '../../../src/patients/patient.routes.js';
import { medicalRecordRouter } from '../../../src/medical-records/medical-record.routes.js';
import { patientTypeService } from '../../../src/patient-types/patient-type.service.js';
import { parseRecordData } from '../../../src/medical-records/record-data.js';
import { FAMILY_TEMPLATE_WITH_LEGACY, INDIVIDUAL_TEMPLATE_WITH_LEGACY } from '../../../src/patient-types/migrated-templates.js';
import { EntityType } from '../../../generated/prisma/enums.ts';
import { createTestPatient, createTestUser, invokeRoute } from '../helpers.js';
import { updatePatientWithin } from '../../../src/patients/patient.service.js';

let userId: string;
let individualId: string;
let familiaId: string;
let patientId: string;

const req = (extra: Record<string, unknown>) => ({ user: { id: userId, timezone: 'America/Bogota' }, ip: '127.0.0.1', ...extra });
const changeType = (patientTypeId: string, id = patientId) =>
  invokeRoute(patientRouter, 'patch', `/${id}`, req({ params: { id }, body: { patientTypeId } }));
const createRecord = (data: Record<string, string> | null) => prisma.medicalRecord.create({
  data: { patientId, ...(data && { data: JSON.stringify(data) }) },
});
const typeChangeAudits = () => prisma.auditLog.findMany({
  where: { entityType: EntityType.PATIENT, entityId: patientId, affectedFields: { has: 'patientTypeId' } },
});

beforeEach(async () => {
  userId = (await createTestUser()).id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
  individualId = patient.patientTypeId;
  await prisma.patientType.update({
    where: { id: individualId },
    data: { name: 'Individual', template: INDIVIDUAL_TEMPLATE_WITH_LEGACY as never, familyMembersEnabled: true },
  });
  familiaId = (await patientTypeService.create(userId, { name: 'Familia' })).id;
  await prisma.patientType.update({
    where: { id: familiaId },
    data: { template: FAMILY_TEMPLATE_WITH_LEGACY as never, familyMembersEnabled: true, subsystemRelationsEnabled: true },
  });
});

describe('changing a patient\'s type', () => {
  it('archives the payload with its template, empties the record and sets the new type', async () => {
    const record = await createRecord({ consultationReason: 'valor-secreto', objective: 'otro-secreto' });

    const res = await changeType(familiaId);

    expect(res.statusCode).toBe(200);
    const snapshots = await prisma.medicalRecordSnapshot.findMany({ where: { medicalRecordId: record.id } });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[ 0 ]).toMatchObject({ patientTypeId: individualId, patientTypeName: 'Individual' });
    expect(snapshots[ 0 ]!.template).toEqual(INDIVIDUAL_TEMPLATE_WITH_LEGACY);
    expect(parseRecordData(snapshots[ 0 ]!.data)).toEqual({ consultationReason: 'valor-secreto', objective: 'otro-secreto' });
    expect((await prisma.medicalRecord.findUniqueOrThrow({ where: { id: record.id } })).data).toBe('{}');
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patientId } })).patientTypeId).toBe(familiaId);
  });

  it('audits the old and new type and the snapshot id, with no field values', async () => {
    await createRecord({ consultationReason: 'valor-secreto' });
    await changeType(familiaId);

    const rows = await typeChangeAudits();
    expect(rows).toHaveLength(1);
    const snapshot = await prisma.medicalRecordSnapshot.findFirstOrThrow({});
    expect(rows[ 0 ]!.affectedFields).toEqual([ 'patientTypeId' ]);
    expect(rows[ 0 ]!.fieldsBefore).toEqual({ patientTypeId: individualId });
    expect(rows[ 0 ]!.fieldsAfter).toEqual({ patientTypeId: familiaId, snapshotId: snapshot.id });
    expect(JSON.stringify(rows[ 0 ])).not.toContain('valor-secreto');
  });

  it('a patient with no record, or an empty payload, changes type with an audit row and no snapshot', async () => {
    expect((await changeType(familiaId)).statusCode).toBe(200);
    await createRecord({});
    expect((await changeType(individualId)).statusCode).toBe(200);

    expect(await prisma.medicalRecordSnapshot.count()).toBe(0);
    const rows = await typeChangeAudits();
    expect(rows.map((r) => r.fieldsAfter)).toEqual(expect.arrayContaining([
      { patientTypeId: familiaId, snapshotId: null },
      { patientTypeId: individualId, snapshotId: null },
    ]));
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patientId } })).patientTypeId).toBe(individualId);
  });

  it('refuses another provider\'s type and changes nothing', async () => {
    const record = await createRecord({ consultationReason: 'a' });
    const other = await createTestUser();

    expect((await changeType(other.defaultPatientTypeId)).statusCode).toBe(404);

    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patientId } })).patientTypeId).toBe(individualId);
    expect(parseRecordData((await prisma.medicalRecord.findUniqueOrThrow({ where: { id: record.id } })).data)).toEqual({ consultationReason: 'a' });
    expect(await prisma.medicalRecordSnapshot.count()).toBe(0);
  });

  it('the same type changes nothing about the record', async () => {
    await createRecord({ consultationReason: 'a' });
    expect((await changeType(individualId)).statusCode).toBe(200);
    expect(await prisma.medicalRecordSnapshot.count()).toBe(0);
    expect(await typeChangeAudits()).toHaveLength(0);
  });

  it('after the change, a save of a key the new template lacks is refused', async () => {
    const record = await createRecord({ objective: 'a' });
    await changeType(familiaId);
    const res = await invokeRoute(medicalRecordRouter, 'patch', `/${record.id}`, req({ params: { id: record.id }, body: { data: { objective: 'x' } } }));
    expect(res.statusCode).toBe(400);
    expect((await prisma.medicalRecord.findUniqueOrThrow({ where: { id: record.id } })).data).toBe('{}');
  });

  it('a save racing the change ends either in the snapshot or in the new record, never both or neither', async () => {
    for (let i = 0; i < 4; i++) {
      await prisma.medicalRecordSnapshot.deleteMany({});
      await prisma.medicalRecord.deleteMany({ where: { patientId } });
      await prisma.patient.update({ where: { id: patientId }, data: { patientTypeId: individualId } });
      const record = await createRecord({ objective: 'previo' });

      const [ change, save ] = await Promise.all([
        changeType(familiaId),
        invokeRoute(medicalRecordRouter, 'patch', `/${record.id}`, req({ params: { id: record.id }, body: { data: { consultationReason: `carrera-${i}` } } })),
      ]);
      expect(change.statusCode).toBe(200);
      expect(save.statusCode).toBe(200);

      const snapshot = await prisma.medicalRecordSnapshot.findFirstOrThrow({ where: { medicalRecordId: record.id } });
      const inSnapshot = parseRecordData(snapshot.data).consultationReason === `carrera-${i}`;
      const inRecord = parseRecordData((await prisma.medicalRecord.findUniqueOrThrow({ where: { id: record.id } })).data).consultationReason === `carrera-${i}`;
      expect(inSnapshot).not.toBe(inRecord);
    }
  });

  // A transaction that changes the type and stays open while `during` runs, so `during` meets the locks it holds.
  const changeTypeHeldOpen = async (during: () => Promise<unknown>) => {
    let pending!: Promise<unknown>;
    await prisma.$transaction(async (tx) => {
      await updatePatientWithin(tx, patientId, { patientTypeId: familiaId }, userId);
      pending = during();
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    return pending;
  };

  it('a save waiting on the record lock during a type change is checked against the new template', async () => {
    const record = await createRecord({ consultationReason: 'previo' });

    const save = await changeTypeHeldOpen(() =>
      invokeRoute(medicalRecordRouter, 'patch', `/${record.id}`, req({ params: { id: record.id }, body: { data: { objective: 'tarde' } } })));

    expect((save as { statusCode: number }).statusCode).toBe(400);
    expect((await prisma.medicalRecord.findUniqueOrThrow({ where: { id: record.id } })).data).toBe('{}');
  });

  it('a record created while the type changes is checked against the new template', async () => {
    const created = await changeTypeHeldOpen(() =>
      invokeRoute(medicalRecordRouter, 'post', '/', req({ body: { patientId, data: { objective: 'tarde' } } })));

    expect((created as { statusCode: number }).statusCode).toBe(400);
    expect(await prisma.medicalRecord.count({ where: { patientId } })).toBe(0);
  });

  it('two simultaneous changes to the same type write one audit row with the true previous type', async () => {
    await createRecord({ consultationReason: 'a' });
    const results = await Promise.all([ changeType(familiaId), changeType(familiaId) ]);
    expect(results.map((r) => r.statusCode)).toEqual([ 200, 200 ]);

    const rows = await typeChangeAudits();
    expect(rows).toHaveLength(1);
    expect(rows[ 0 ]!.fieldsBefore).toEqual({ patientTypeId: individualId });
    expect(await prisma.medicalRecordSnapshot.count()).toBe(1);
  });

  it('two simultaneous changes of a patient with no record write one audit row', async () => {
    await Promise.all([ changeType(familiaId), changeType(familiaId) ]);
    expect(await typeChangeAudits()).toHaveLength(1);
  });
});
