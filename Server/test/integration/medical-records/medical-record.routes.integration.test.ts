import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { medicalRecordRouter } from '../../../src/medical-records/medical-record.routes.js';
import { createTestUser, createTestPatient, invokeRoute } from '../helpers.js';

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

    const restored = await invokeRoute(medicalRecordRouter, 'post', `/${id}/restore`, baseReq({ params: { id } }));
    expect(restored.statusCode).toBe(200);
    expect((restored.body as any).data.isDeleted).toBe(false);
  });
});
