import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { medicalRecordRouter } from '../../../src/medical-records/medical-record.routes.js';
import { createTestUser, createTestPatient, invokeRoute } from '../helpers.js';
import { patientRouter } from '../../../src/patients/patient.routes.js';
import { parseRecordData } from '../../../src/medical-records/record-data.js';

let userId: string;
let patientId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
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

describe('release A: the payload follows the clinical columns', () => {
  const payloadOf = async (id: string) => parseRecordData((await prisma.medicalRecord.findUniqueOrThrow({ where: { id } })).data);
  const create = async (body: Record<string, unknown> = {}) => {
    const res = await invokeRoute(medicalRecordRouter, 'post', '/', baseReq({ body: { patientId, ...body } }));
    expect(res.statusCode).toBe(201);
    return (res.body as any).data.id as string;
  };
  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await invokeRoute(medicalRecordRouter, 'patch', `/${id}`, baseReq({ params: { id }, body }));
    expect(res.statusCode).toBe(200);
    return res;
  };

  it('POST writes the payload from the clinical columns, skipping empty ones', async () => {
    const id = await create({ consultationReason: 'a', objective: '', genogram: 'g', name: 'Ana' });
    expect(await payloadOf(id)).toEqual({ consultationReason: 'a', genogram: 'g' });
  });

  it('PATCH keeps the payload equal to the columns, clearing a key when a column is emptied', async () => {
    const id = await create({ consultationReason: 'a', genogram: 'g' });
    await patch(id, { objective: 'b' });
    await patch(id, { consultationReason: '' });
    expect(await payloadOf(id)).toEqual({ genogram: 'g', objective: 'b' });
  });

  it('PATCH of a record never copied fills the payload from every column', async () => {
    const { id } = await prisma.medicalRecord.create({
      data: { patientId, consultationReason: 'a', genogram: 'g', objective: 'o' },
    });
    expect((await prisma.medicalRecord.findUniqueOrThrow({ where: { id } })).data).toBeNull();
    await patch(id, { rule: 'r' });
    expect(await payloadOf(id)).toEqual({ consultationReason: 'a', genogram: 'g', objective: 'o', rule: 'r' });
  });

  it('PATCH repairs a payload that fell behind the columns, keeping keys that are not columns', async () => {
    const id = await create({ consultationReason: 'a', genogram: 'g' });
    await prisma.medicalRecord.update({ where: { id }, data: { data: JSON.stringify({ consultationReason: 'old', legacy: 'z' }) } });
    await patch(id, { objective: 'b' });
    expect(await payloadOf(id)).toEqual({ consultationReason: 'a', genogram: 'g', legacy: 'z', objective: 'b' });

    await prisma.medicalRecord.update({ where: { id }, data: { data: JSON.stringify({ consultationReason: 'old' }) } });
    await patch(id, { name: 'Solo identidad' });
    expect(await payloadOf(id)).toEqual({ consultationReason: 'a', genogram: 'g', objective: 'b' });
  });

  it('PATCH touching only identity columns leaves the payload as is', async () => {
    const id = await create({ consultationReason: 'a' });
    const before = (await prisma.medicalRecord.findUniqueOrThrow({ where: { id } })).data;
    await patch(id, { name: 'Nuevo nombre' });
    expect((await prisma.medicalRecord.findUniqueOrThrow({ where: { id } })).data).toBe(before);
  });

  it('concurrent PATCHes of different columns both reach the payload', async () => {
    const id = await create({ consultationReason: 'a' });
    const columns = [ 'rule', 'limits', 'genogram', 'resources', 'objective', 'lifecycle' ];
    await Promise.all(columns.map((c) => patch(id, { [ c ]: c })));
    expect(await payloadOf(id)).toEqual({ consultationReason: 'a', ...Object.fromEntries(columns.map((c) => [ c, c ])) });
  });

  it('no response carries data', async () => {
    const created = await invokeRoute(medicalRecordRouter, 'post', '/', baseReq({ body: { patientId, consultationReason: 'a' } }));
    const id = (created.body as any).data.id as string;
    const responses = [
      created,
      await patch(id, { objective: 'b' }),
      await invokeRoute(medicalRecordRouter, 'get', `/${id}`, baseReq({ params: { id } })),
    ];
    const list = await invokeRoute(medicalRecordRouter, 'get', '/', baseReq({ query: { patientId } }));
    await invokeRoute(medicalRecordRouter, 'delete', `/${id}`, baseReq({ params: { id } }));
    const restored = await invokeRoute(medicalRecordRouter, 'post', `/${id}/restore`, baseReq({ params: { id }, user: { id: userId, role: 'SUPER_ADMIN', timezone: 'America/Bogota' } }));
    const patient = await invokeRoute(patientRouter, 'get', `/${patientId}`, baseReq({ params: { id: patientId } }));

    for (const res of [ ...responses, restored ]) {
      expect(res.statusCode).toBeLessThan(300);
      expect((res.body as any).data).not.toHaveProperty('data');
    }
    expect((list.body as any).data.data[ 0 ]).not.toHaveProperty('data');
    expect(patient.statusCode).toBe(200);
    expect((patient.body as any).data.medicalRecord).toBeTruthy();
    expect((patient.body as any).data.medicalRecord).not.toHaveProperty('data');
  });
});
