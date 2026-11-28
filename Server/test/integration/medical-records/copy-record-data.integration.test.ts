import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { copyRecordData, verifyRecordData } from '../../../src/medical-records/copy-record-data.js';
import { parseRecordData } from '../../../src/medical-records/record-data.js';
import { createTestPatient, createTestUser } from '../helpers.js';

const ENC = /^enc:v2:[0-9a-f]{8}:/;

let userId: string;
let ids: string[];

const newRecord = async (data: Record<string, unknown>) => {
  const patient = await createTestPatient(userId);
  return (await prisma.medicalRecord.create({ data: { patientId: patient.id, ...data } })).id;
};

const payloadOf = async (id: string) => parseRecordData((await prisma.medicalRecord.findUniqueOrThrow({ where: { id } })).data);

beforeEach(async () => {
  userId = (await createTestUser()).id;
  ids = [
    await newRecord({ consultationReason: 'a', genogram: 'g' }),
    await newRecord({ objective: 'o', rule: '' }),
    await newRecord({ limits: 'l', isDeleted: true, deletedAt: new Date() }),
  ];
});

describe('copyRecordData', () => {
  it('copies every record, soft-deleted included, and verify then reports nothing', async () => {
    const before = await verifyRecordData();
    expect(before.missing.sort()).toEqual([ ...ids ].sort());

    const result = await copyRecordData({ batchSize: 2 });
    expect(result).toMatchObject({ scanned: 3, written: 3, unchanged: 0, skipped: 0, failed: [], dryRun: false });
    expect(await payloadOf(ids[ 0 ]!)).toEqual({ consultationReason: 'a', genogram: 'g' });
    expect(await payloadOf(ids[ 1 ]!)).toEqual({ objective: 'o' });
    expect(await payloadOf(ids[ 2 ]!)).toEqual({ limits: 'l' });

    const [ row ] = await prisma.$queryRaw<{ data: string }[]>`SELECT "data" FROM "medical_records" WHERE "id" = ${ids[ 0 ]}::uuid`;
    expect(row!.data).toMatch(ENC);

    expect(await verifyRecordData()).toEqual({ scanned: 3, missing: [], mismatched: [], failed: [] });
  });

  it('runs twice safely: the second run writes nothing', async () => {
    await copyRecordData();
    expect(await copyRecordData()).toMatchObject({ scanned: 3, written: 0, unchanged: 3, skipped: 0 });
  });

  it('keeps payload keys that are not columns', async () => {
    await prisma.medicalRecord.update({ where: { id: ids[ 0 ]! }, data: { data: JSON.stringify({ legacy: 'z', consultationReason: 'old' }) } });
    await copyRecordData();
    expect(await payloadOf(ids[ 0 ]!)).toEqual({ legacy: 'z', consultationReason: 'a', genogram: 'g' });
  });

  it('a dry run writes nothing and counts what it would write', async () => {
    expect(await copyRecordData({ dryRun: true })).toMatchObject({ scanned: 3, written: 3, dryRun: true });
    expect((await verifyRecordData()).missing).toHaveLength(3);
  });

  it('skips a row changed after it was read and never overwrites the newer payload', async () => {
    const [ first ] = [ ...ids ].sort();
    let changed = false;
    const result = await copyRecordData({
      batchSize: 1,
      onBatch: async () => {
        if (changed) return;
        changed = true;
        await prisma.medicalRecord.update({ where: { id: first! }, data: { familyType: 'nuevo' } });
      },
    });
    expect(result).toMatchObject({ written: 2, skipped: 1 });

    expect(await copyRecordData()).toMatchObject({ written: 1, unchanged: 2 });
    expect((await payloadOf(first!)).familyType).toBe('nuevo');
    expect(await verifyRecordData()).toMatchObject({ missing: [], mismatched: [], failed: [] });
  });

  it('does not bump updatedAt', async () => {
    const before = await prisma.medicalRecord.findUniqueOrThrow({ where: { id: ids[ 0 ]! } });
    await copyRecordData();
    const after = await prisma.medicalRecord.findUniqueOrThrow({ where: { id: ids[ 0 ]! } });
    expect(after.updatedAt).toEqual(before.updatedAt);
  });

  it('reports a value no key opens by id and carries on', async () => {
    await prisma.$executeRaw`UPDATE "medical_records" SET "objective" = 'enc:v2:deadbeef:AAAA' WHERE "id" = ${ids[ 1 ]}::uuid`;
    const result = await copyRecordData();
    expect(result).toMatchObject({ written: 2, failed: [ ids[ 1 ] ] });
    expect((await verifyRecordData()).failed).toEqual([ ids[ 1 ] ]);
  });

  it('reports a corrupt payload by id and carries on', async () => {
    await prisma.medicalRecord.update({ where: { id: ids[ 1 ]! }, data: { data: 'Duelo de María' } });
    const result = await copyRecordData();
    expect(result).toMatchObject({ written: 2, failed: [ ids[ 1 ] ] });
    const verify = await verifyRecordData();
    expect(verify).toMatchObject({ missing: [], mismatched: [], failed: [ ids[ 1 ] ] });
    expect(JSON.stringify(verify)).not.toContain('María');
  });
});

describe('verifyRecordData', () => {
  it('reports a mismatch by id and key name only', async () => {
    await copyRecordData();
    await prisma.medicalRecord.update({ where: { id: ids[ 1 ]! }, data: { data: JSON.stringify({ objective: 'otro', rule: 'r' }) } });
    const result = await verifyRecordData();
    expect(result.mismatched).toEqual([ { recordId: ids[ 1 ], keys: [ 'objective', 'rule' ] } ]);
    expect(JSON.stringify(result)).not.toContain('otro');
  });

  it('treats an empty-string column as an absent key', async () => {
    await copyRecordData();
    expect((await verifyRecordData()).mismatched).toEqual([]);
    expect((await prisma.medicalRecord.findUniqueOrThrow({ where: { id: ids[ 1 ]! } })).rule).toBe('');
  });
});
