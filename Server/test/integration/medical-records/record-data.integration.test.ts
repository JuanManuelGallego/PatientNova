import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { mergeRecordData, parseRecordData } from '../../../src/medical-records/record-data.js';
import { RecordDataInvalidError } from '../../../src/medical-records/medical-record.errors.js';
import type { RecordTemplate } from '../../../src/patient-types/record-template.js';
import { createTestPatient, createTestUser } from '../helpers.js';

const ENC = /^enc:v2:[0-9a-f]{8}:/;

const templateOf = (keys: string[], removed: string[] = []): RecordTemplate => ({
  sections: [ {
    title: 'S',
    fields: [ ...keys, ...removed ].map((key) => ({
      key,
      label: key,
      kind: 'longText' as const,
      required: false,
      removedAt: removed.includes(key) ? '2026-01-01T00:00:00.000Z' : null,
    })),
  } ],
});

let recordId: string;
let patientTypeId: string;

const useTemplate = (template: RecordTemplate) =>
  prisma.patientType.update({ where: { id: patientTypeId }, data: { template: template as never } });

beforeEach(async () => {
  const user = await createTestUser();
  const patient = await createTestPatient(user.id);
  patientTypeId = patient.patientTypeId;
  recordId = (await prisma.medicalRecord.create({
    data: { patientId: patient.id, objective: 'col', data: JSON.stringify({ consultationReason: 'a', legacy: 'z' }) },
  })).id;
});

const stored = async () => parseRecordData((await prisma.medicalRecord.findUniqueOrThrow({ where: { id: recordId } })).data);

describe('mergeRecordData', () => {
  it('merges changed keys into the encrypted payload and keeps the others', async () => {
    await useTemplate(templateOf([ 'consultationReason', 'objective' ]));
    const merged = await prisma.$transaction((tx) => mergeRecordData(tx, recordId, { objective: 'b', consultationReason: '' }));
    expect(merged).toEqual({ before: { consultationReason: 'a', legacy: 'z' }, after: { legacy: 'z', objective: 'b' } });
    expect(await stored()).toEqual({ legacy: 'z', objective: 'b' });

    const [ row ] = await prisma.$queryRaw<{ data: string }[]>`SELECT "data" FROM "medical_records" WHERE "id" = ${recordId}::uuid`;
    expect(row!.data).toMatch(ENC);
  });

  it('concurrent saves of different keys both survive', async () => {
    const keys = Array.from({ length: 12 }, (_, i) => `k${i}`);
    await useTemplate(templateOf(keys));
    await Promise.all(keys.map((k) => prisma.$transaction((tx) => mergeRecordData(tx, recordId, { [ k ]: k }))));
    expect(await stored()).toEqual({ consultationReason: 'a', legacy: 'z', ...Object.fromEntries(keys.map((k) => [ k, k ])) });
  });

  it('refuses an invalid change before writing anything', async () => {
    await useTemplate(templateOf([ 'objective' ], [ 'viejo' ]));
    await expect(prisma.$transaction((tx) => mergeRecordData(tx, recordId, { objective: 'b', viejo: 'x' })))
      .rejects.toThrow(RecordDataInvalidError);
    expect(await stored()).toEqual({ consultationReason: 'a', legacy: 'z' });
  });

  it('never touches the clinical columns', async () => {
    await useTemplate(templateOf([ 'objective' ]));
    await prisma.$transaction((tx) => mergeRecordData(tx, recordId, { objective: 'x' }));
    expect((await prisma.medicalRecord.findUniqueOrThrow({ where: { id: recordId } })).objective).toBe('col');
  });
});
