import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { appointmentRouter } from '../../../src/appointments/appointment.routes.js';
import {
  createTestUser,
  createTestPatient,
  createTestLocation,
  createTestAppointmentType,
  appointmentTimeRange,
  invokeRoute,
} from '../helpers.js';
import { AppointmentStatus } from '../../../generated/prisma/client.ts';

let userId: string;
let patientId: string;
let locationId: string;
let typeId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
  // Non-virtual location so the meeting-URL resolver does not call the Google API.
  locationId = (await createTestLocation(userId, { name: 'Office' })).id;
  typeId = (await createTestAppointmentType(userId)).id;
});

function createBody(overrides: Record<string, unknown> = {}) {
  const { start, end } = appointmentTimeRange(60, 30);
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    timezone: 'America/Bogota',
    price: 50000,
    paid: false,
    status: AppointmentStatus.SCHEDULED,
    patientId,
    locationId,
    typeId,
    ...overrides,
  };
}

function baseReq(extra: Record<string, unknown> = {}) {
  return {
    user: { id: userId, timezone: 'America/Bogota' },
    ip: '127.0.0.1',
    ...extra,
  };
}

describe('appointment routes (integration)', () => {
  it('POST / creates an appointment and returns 201', async () => {
    const res = await invokeRoute(appointmentRouter, 'post', '/', baseReq({ body: createBody() }));

    expect(res.statusCode).toBe(201);
    const id = (res.body as any).data.id;
    expect(id).toBeTruthy();

    const stored = await prisma.appointment.findUnique({ where: { id } });
    expect(stored!.userId).toBe(userId);
    expect(stored!.price).toBe(50000);
  });

  it('POST / rejects an overlapping appointment with 409', async () => {
    const first = await invokeRoute(appointmentRouter, 'post', '/', baseReq({ body: createBody() }));
    expect(first.statusCode).toBe(201);

    // Overlap with the just-created appointment (same 30-min window).
    const res = await invokeRoute(appointmentRouter, 'post', '/', baseReq({ body: createBody() }));
    expect(res.statusCode).toBe(409);
  });

  it('POST / returns 400 when the body fails validation (endAt before startAt)', async () => {
    const { start, end } = appointmentTimeRange(60, 30);
    const res = await invokeRoute(
      appointmentRouter,
      'post',
      '/',
      baseReq({ body: createBody({ startAt: end.toISOString(), endAt: start.toISOString() }) }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('GET /:id returns the created appointment', async () => {
    const created = await invokeRoute(appointmentRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const res = await invokeRoute(appointmentRouter, 'get', `/${id}`, baseReq({ params: { id } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.id).toBe(id);
  });

  it('GET /:id returns 404 for a non-owned appointment id', async () => {
    const otherUser = await createTestUser();
    const otherPatient = await createTestPatient(otherUser.id);
    const otherLoc = await createTestLocation(otherUser.id);
    const otherType = await createTestAppointmentType(otherUser.id);
    const { start, end } = appointmentTimeRange(120, 30);
    const otherAppt = await prisma.appointment.create({
      data: {
        startAt: start,
        endAt: end,
        price: 0,
        status: AppointmentStatus.SCHEDULED,
        patientId: otherPatient.id,
        userId: otherUser.id,
        locationId: otherLoc.id,
        typeId: otherType.id,
      },
    });

    const res = await invokeRoute(
      appointmentRouter,
      'get',
      `/${otherAppt.id}`,
      baseReq({ params: { id: otherAppt.id } }),
    );
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /:id updates the appointment', async () => {
    const created = await invokeRoute(appointmentRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const res = await invokeRoute(
      appointmentRouter,
      'patch',
      `/${id}`,
      baseReq({ params: { id }, body: { price: 75000 } }),
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.price).toBe(75000);
  });

  it('POST /:id/confirm then /cancel follows the state machine', async () => {
    const created = await invokeRoute(appointmentRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const confirmed = await invokeRoute(
      appointmentRouter,
      'post',
      `/${id}/confirm`,
      baseReq({ params: { id } }),
    );
    expect(confirmed.statusCode).toBe(200);
    expect((confirmed.body as any).data.status).toBe(AppointmentStatus.CONFIRMED);

    const cancelled = await invokeRoute(
      appointmentRouter,
      'post',
      `/${id}/cancel`,
      baseReq({ params: { id } }),
    );
    expect(cancelled.statusCode).toBe(200);
    expect((cancelled.body as any).data.status).toBe(AppointmentStatus.CANCELLED);
  });

  it('POST /:id/pay marks the appointment paid', async () => {
    const created = await invokeRoute(appointmentRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const res = await invokeRoute(appointmentRouter, 'post', `/${id}/pay`, baseReq({ params: { id } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.paid).toBe(true);

    const stored = await prisma.appointment.findUnique({ where: { id } });
    expect(stored!.paid).toBe(true);
  });

  it('GET / lists only the owning user appointments', async () => {
    await invokeRoute(appointmentRouter, 'post', '/', baseReq({ body: createBody() }));

    const res = await invokeRoute(appointmentRouter, 'get', '/', baseReq({ query: {} }));
    expect(res.statusCode).toBe(200);
    const data = (res.body as any).data;
    expect(data.total).toBe(1);
    expect(data.data).toHaveLength(1);
  });

  it('GET /stats aggregates by status', async () => {
    await invokeRoute(appointmentRouter, 'post', '/', baseReq({ body: createBody() }));

    const res = await invokeRoute(appointmentRouter, 'get', '/stats', baseReq({ query: {} }));
    expect(res.statusCode).toBe(200);
    const stats = (res.body as any).data;
    expect(stats.total).toBe(1);
    expect(stats.byStatus[AppointmentStatus.SCHEDULED]).toBe(1);
  });

  it('DELETE /:id soft-deletes and PATCH /:id/restore brings it back', async () => {
    const created = await invokeRoute(appointmentRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const del = await invokeRoute(appointmentRouter, 'delete', `/${id}`, baseReq({ params: { id } }));
    expect(del.statusCode).toBe(200);
    expect((del.body as any).data.deleted).toBe(true);

    const raw = await prisma.appointment.findUnique({ where: { id } });
    expect(raw!.isDeleted).toBe(true);

    const restored = await invokeRoute(
      appointmentRouter,
      'patch',
      `/${id}/restore`,
      baseReq({ params: { id } }),
    );
    expect(restored.statusCode).toBe(200);
    expect((restored.body as any).data.isDeleted).toBe(false);
  });

  it('GET /:id returns 400 for a non-UUID param', async () => {
    const res = await invokeRoute(
      appointmentRouter,
      'get',
      '/not-a-uuid',
      baseReq({ params: { id: 'not-a-uuid' } }),
    );
    expect(res.statusCode).toBe(400);
  });
});
