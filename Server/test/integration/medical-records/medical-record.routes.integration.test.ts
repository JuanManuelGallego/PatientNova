import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { medicalRecordRouter } from '../../../src/medical-records/medical-record.routes.js';
import { createTestUser, createTestPatient, invokeRoute } from '../helpers.js';
import { patientRouter } from '../../../src/patients/patient.routes.js';
import { parseRecordData } from '../../../src/medical-records/record-data.js';
import { INDIVIDUAL_TEMPLATE_WITH_LEGACY } from '../../../src/patient-types/migrated-templates.js';
import { EntityType } from '../../../generated/prisma/enums.ts';

let userId: string;
let patientId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
  await prisma.patientType.update({
    where: { id: patient.patientTypeId },
    data: { name: 'Individual', template: INDIVIDUAL_TEMPLATE_WITH_LEGACY as never, familyMembersEnabled: true },
  });
});

function baseReq(extra: Record<string, unknown> = {}) {
  return {
    user: { id: userId, timezone: 'America/Bogota' },
    ip: '127.0.0.1',
    ...extra,
  };
}

describe('medical-record routes (integration)', () => {
  it('POST / creates a record and DELETE /:id soft-deletes it (recoverable)', async () => {
    const created = await invokeRoute(medicalRecordRouter, 'post', '/', baseReq({ body: { patientId } }));
    expect(created.statusCode).toBe(201);
    const id = (created.body as any).data.id;

    const del = await invokeRoute(medicalRecordRouter, 'delete', `/${id}`, baseReq({ params: { id } }));
    expect(del.statusCode).toBe(200);
    expect((del.body as any).data.deleted).toBe(true);

    const raw = await prisma.medicalRecord.findUnique({ where: { id } });
    expect(raw!.isDeleted).toBe(true);
  });

  it('POST /:id/restore un-deletes a soft-deleted record', async () => {
    const created = await invokeRoute(medicalRecordRouter, 'post', '/', baseReq({ body: { patientId } }));
    const id = (created.body as any).data.id;
    await invokeRoute(medicalRecordRouter, 'delete', `/${id}`, baseReq({ params: { id } }));

    const restored = await invokeRoute(medicalRecordRouter, 'post', `/${id}/restore`, baseReq({ params: { id }, user: { id: userId, role: 'SUPER_ADMIN', timezone: 'America/Bogota' } }));
    expect(restored.statusCode).toBe(200);
    expect((restored.body as any).data.isDeleted).toBe(false);
  });
});

describe('release B: records through the payload', () => {
  const payloadOf = async (id: string) => parseRecordData((await prisma.medicalRecord.findUniqueOrThrow({ where: { id } })).data);
  const create = async (body: Record<string, unknown> = {}) => {
    const res = await invokeRoute(medicalRecordRouter, 'post', '/', baseReq({ body: { patientId, ...body } }));
    expect(res.statusCode).toBe(201);
    return res;
  };
  const patch = (id: string, body: Record<string, unknown>) =>
    invokeRoute(medicalRecordRouter, 'patch', `/${id}`, baseReq({ params: { id }, body }));
  const idOf = (res: { body: unknown }) => (res.body as any).data.id as string;
  const updateAudits = (id: string) => prisma.auditLog.findMany({
    where: { entityType: EntityType.MEDICAL_RECORD, entityId: id, actionType: 'UPDATE' },
    orderBy: { eventTimeUtc: 'asc' },
  });

  it('POST stores data, returns data, the type and no clinical columns', async () => {
    const res = await create({ data: { consultationReason: 'x', objective: '' } });
    const body = (res.body as any).data;
    expect(body.data).toEqual({ consultationReason: 'x' });
    expect(body.patientType).toMatchObject({ name: 'Individual', familyMembersEnabled: true, subsystemRelationsEnabled: false });
    expect(body.patientType.template).toEqual(INDIVIDUAL_TEMPLATE_WITH_LEGACY);
    expect(body.snapshots).toEqual([]);
    for (const key of [ 'consultationReason', 'isFamily', 'nameTokens', 'piiVersion', 'patient' ]) expect(body).not.toHaveProperty(key);
    expect(await payloadOf(body.id)).toEqual({ consultationReason: 'x' });
    expect((await prisma.medicalRecord.findUniqueOrThrow({ where: { id: body.id } })).consultationReason).toBeNull();
  });

  it('refuses a removed or unknown key on create and update', async () => {
    const bad = await invokeRoute(medicalRecordRouter, 'post', '/', baseReq({ body: { patientId, data: { genogram: 'x' } } }));
    expect(bad.statusCode).toBe(400);
    expect(await prisma.medicalRecord.count({ where: { patientId } })).toBe(0);

    const id = idOf(await create({ data: { objective: 'o' } }));
    for (const data of [ { genogram: 'x' }, { inventada: 'x' } ]) {
      expect((await patch(id, { data })).statusCode).toBe(400);
    }
    expect(await payloadOf(id)).toEqual({ objective: 'o' });
  });

  it('PATCH merges only the keys it sends; an empty string clears a key', async () => {
    const id = idOf(await create({ data: { consultationReason: 'a' } }));
    expect((await patch(id, { data: { objective: 'b' } })).statusCode).toBe(200);
    expect((await patch(id, { data: { mentalHistory: 'm' } })).statusCode).toBe(200);
    const cleared = await patch(id, { data: { objective: '' } });
    expect(cleared.statusCode).toBe(200);
    expect((cleared.body as any).data.data).toEqual({ consultationReason: 'a', mentalHistory: 'm' });
    expect(await payloadOf(id)).toEqual({ consultationReason: 'a', mentalHistory: 'm' });
  });

  it('concurrent PATCHes of different keys all survive', async () => {
    const id = idOf(await create());
    const keys = [ 'consultationReason', 'objective', 'mentalHistory', 'schoolAndWork', 'lifestyleHabits', 'familyObservations' ];
    const results = await Promise.all(keys.map((k) => patch(id, { data: { [ k ]: k } })));
    expect(results.map((r) => r.statusCode)).toEqual(keys.map(() => 200));
    expect(await payloadOf(id)).toEqual(Object.fromEntries(keys.map((k) => [ k, k ])));
  });

  it('audits only the changed keys of the payload', async () => {
    const id = idOf(await create({ data: { consultationReason: 'a', objective: 'o' } }));
    await patch(id, { data: { objective: 'nuevo', consultationReason: 'a' } });
    await patch(id, { name: 'Solo nombre' });
    const [ edit, rename ] = await updateAudits(id);
    expect(edit!.affectedFields).toEqual([ 'data.objective' ]);
    expect(edit!.fieldsBefore).toEqual({ 'data.objective': 'o' });
    expect(edit!.fieldsAfter).toEqual({ 'data.objective': 'nuevo' });
    expect(rename!.affectedFields).toEqual([ 'name' ]);
  });

  it('the create audit holds the sent keys, never the whole payload object', async () => {
    const id = idOf(await create({ name: 'Ana', data: { consultationReason: 'a' } }));
    const [ row ] = await prisma.auditLog.findMany({ where: { entityType: EntityType.MEDICAL_RECORD, entityId: id, actionType: 'CREATE' } });
    expect([ ...row!.affectedFields ].sort()).toEqual([ 'data.consultationReason', 'name', 'patientId' ]);
    expect(row!.fieldsAfter).toEqual({ patientId, name: 'Ana', 'data.consultationReason': 'a' });
  });

  it('GET returns data, the type and the snapshots with parsed data, newest first', async () => {
    const id = idOf(await create({ data: { consultationReason: 'a' } }));
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: patientId } });
    for (const [ n, at ] of [ [ 1, '2026-01-01T00:00:00Z' ], [ 2, '2026-02-01T00:00:00Z' ] ] as const) {
      await prisma.medicalRecordSnapshot.create({
        data: {
          medicalRecordId: id, patientTypeId: patient.patientTypeId, patientTypeName: `Tipo ${n}`,
          template: { sections: [] }, data: JSON.stringify({ viejo: String(n) }), createdAt: new Date(at),
        },
      });
    }
    const one = await invokeRoute(medicalRecordRouter, 'get', `/${id}`, baseReq({ params: { id } }));
    const list = await invokeRoute(medicalRecordRouter, 'get', '/', baseReq({ query: { patientId } }));
    for (const record of [ (one.body as any).data, (list.body as any).data.data[ 0 ] ]) {
      expect(record.data).toEqual({ consultationReason: 'a' });
      expect(record.patientType.name).toBe('Individual');
      expect(record.snapshots.map((s: any) => [ s.patientTypeName, s.data ])).toEqual([ [ 'Tipo 2', { viejo: '2' } ], [ 'Tipo 1', { viejo: '1' } ] ]);
    }
  });

  it('the patient detail exposes only the record id', async () => {
    await create({ data: { consultationReason: 'a' } });
    const res = await invokeRoute(patientRouter, 'get', `/${patientId}`, baseReq({ params: { id: patientId } }));
    expect(res.statusCode).toBe(200);
    expect(Object.keys((res.body as any).data.medicalRecord)).toEqual([ 'id' ]);
  });
});
