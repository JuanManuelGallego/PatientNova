import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { patientRouter } from '../../../src/patients/patient.routes.js';
import { createTestUser, createTestPatient, invokeRoute } from '../helpers.js';
import { PatientStatus } from '../../../generated/prisma/client.ts';

let userId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
});

function baseReq(extra: Record<string, unknown> = {}) {
  return {
    user: { id: userId, timezone: 'America/Bogota' },
    ip: '127.0.0.1',
    ...extra,
  };
}

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Ana',
    lastName: 'Lopez',
    email: `ana-${Date.now()}@test.local`,
    whatsappNumber: '+57300123456',
    status: PatientStatus.ACTIVE,
    ...overrides,
  };
}

describe('patient routes (integration)', () => {
  it('POST / creates a patient and returns 201', async () => {
    const res = await invokeRoute(patientRouter, 'post', '/', baseReq({ body: createBody() }));
    expect(res.statusCode).toBe(201);
    const id = (res.body as any).data.id;
    expect(id).toBeTruthy();

    const stored = await prisma.patient.findUnique({ where: { id } });
    expect(stored!.userId).toBe(userId);
    expect(stored!.name).toBe('Ana');
  });

  it('POST / returns 400 when name is missing', async () => {
    const { name, ...rest } = createBody();
    const res = await invokeRoute(patientRouter, 'post', '/', baseReq({ body: rest }));
    expect(res.statusCode).toBe(400);
  });

  it('GET /:id returns the patient with relations', async () => {
    const created = await invokeRoute(patientRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const res = await invokeRoute(patientRouter, 'get', `/${id}`, baseReq({ params: { id } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.id).toBe(id);
    expect((res.body as any).data.appointments).toBeDefined();
  });

  it('GET /:id returns 404 for a non-owned patient', async () => {
    const otherPatient = await createTestPatient((await createTestUser()).id);
    const res = await invokeRoute(
      patientRouter,
      'get',
      `/${otherPatient.id}`,
      baseReq({ params: { id: otherPatient.id } }),
    );
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /:id updates the patient', async () => {
    const created = await invokeRoute(patientRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const res = await invokeRoute(
      patientRouter,
      'patch',
      `/${id}`,
      baseReq({ params: { id }, body: { lastName: 'Martinez' } }),
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.lastName).toBe('Martinez');
  });

  it('GET / lists only the owning user patients', async () => {
    await invokeRoute(patientRouter, 'post', '/', baseReq({ body: createBody() }));
    const res = await invokeRoute(patientRouter, 'get', '/', baseReq({ query: {} }));
    expect(res.statusCode).toBe(200);
    const data = (res.body as any).data;
    expect(data.total).toBe(1);
    expect(data.data[0].name).toBe('Ana');
  });

  it('GET /stats aggregates by status', async () => {
    await invokeRoute(patientRouter, 'post', '/', baseReq({ body: createBody() }));
    const res = await invokeRoute(patientRouter, 'get', '/stats', baseReq({ query: {} }));
    expect(res.statusCode).toBe(200);
    const stats = (res.body as any).data;
    expect(stats.total).toBe(1);
    expect(stats.byStatus[PatientStatus.ACTIVE]).toBe(1);
  });

  it('DELETE /:id soft-deletes and PATCH /:id/restore recovers it', async () => {
    const created = await invokeRoute(patientRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const del = await invokeRoute(patientRouter, 'delete', `/${id}`, baseReq({ params: { id } }));
    expect(del.statusCode).toBe(200);
    expect((del.body as any).data.deleted).toBe(true);

    const raw = await prisma.patient.findUnique({ where: { id } });
    expect(raw!.isDeleted).toBe(true);

    const restored = await invokeRoute(
      patientRouter,
      'patch',
      `/${id}/restore`,
      baseReq({ params: { id } }),
    );
    expect(restored.statusCode).toBe(200);
    expect((restored.body as any).data.isDeleted).toBe(false);
  });
});
