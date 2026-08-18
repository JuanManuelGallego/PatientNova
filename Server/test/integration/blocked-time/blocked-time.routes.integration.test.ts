import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { blockedTimeRouter } from '../../../src/blocked-time/blocked-time.routes.js';
import {
  createTestUser,
  appointmentTimeRange,
  invokeRoute,
} from '../helpers.js';

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
  const { start, end } = appointmentTimeRange(120, 60);
  return {
    description: 'Meeting',
    startTimeUtc: start.toISOString(),
    endTimeUtc: end.toISOString(),
    ...overrides,
  };
}

describe('blocked-time routes (integration)', () => {
  it('POST / creates a blocked time slot and returns 201', async () => {
    const res = await invokeRoute(blockedTimeRouter, 'post', '/', baseReq({ body: createBody() }));
    expect(res.statusCode).toBe(201);
    const id = (res.body as any).data.id;
    expect(id).toBeTruthy();

    const stored = await prisma.blockedTime.findUnique({ where: { id } });
    expect(stored!.userId).toBe(userId);
    expect(stored!.description).toBe('Meeting');
  });

  it('POST / creates with null description when omitted', async () => {
    const { start, end } = appointmentTimeRange(120, 60);
    const res = await invokeRoute(
      blockedTimeRouter,
      'post',
      '/',
      baseReq({ body: { startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() } }),
    );
    expect(res.statusCode).toBe(201);
    expect((res.body as any).data.description).toBeNull();
  });

  it('POST / returns 400 when body fails validation (missing fields)', async () => {
    const res = await invokeRoute(blockedTimeRouter, 'post', '/', baseReq({ body: {} }));
    expect(res.statusCode).toBe(400);
  });

  it('POST / returns 400 when endTimeUtc is before startTimeUtc', async () => {
    const { start, end } = appointmentTimeRange(120, 60);
    const res = await invokeRoute(
      blockedTimeRouter,
      'post',
      '/',
      baseReq({ body: { description: 'Bad', startTimeUtc: end.toISOString(), endTimeUtc: start.toISOString() } }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('POST / returns 400 when description is empty string', async () => {
    const { start, end } = appointmentTimeRange(120, 60);
    const res = await invokeRoute(
      blockedTimeRouter,
      'post',
      '/',
      baseReq({ body: { description: '', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() } }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('GET /:id returns the created blocked time slot', async () => {
    const created = await invokeRoute(blockedTimeRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const res = await invokeRoute(blockedTimeRouter, 'get', `/${id}`, baseReq({ params: { id } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.id).toBe(id);
    expect((res.body as any).data.description).toBe('Meeting');
  });

  it('GET /:id returns 404 for a non-owned blocked time slot', async () => {
    const other = await createTestUser();
    const { start, end } = appointmentTimeRange(120, 60);
    const otherBt = await prisma.blockedTime.create({
      data: {
        userId: other.id,
        description: 'Other',
        startTimeUtc: start,
        endTimeUtc: end,
      },
    });

    const res = await invokeRoute(
      blockedTimeRouter,
      'get',
      `/${otherBt.id}`,
      baseReq({ params: { id: otherBt.id } }),
    );
    expect(res.statusCode).toBe(404);
  });

  it('GET /:id returns 400 for a non-UUID param', async () => {
    const res = await invokeRoute(
      blockedTimeRouter,
      'get',
      '/not-a-uuid',
      baseReq({ params: { id: 'not-a-uuid' } }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('GET / lists only the owning user blocked time slots', async () => {
    await invokeRoute(blockedTimeRouter, 'post', '/', baseReq({ body: createBody() }));

    const other = await createTestUser();
    const { start, end } = appointmentTimeRange(120, 60);
    await prisma.blockedTime.create({
      data: { userId: other.id, description: 'Other', startTimeUtc: start, endTimeUtc: end },
    });

    const res = await invokeRoute(blockedTimeRouter, 'get', '/', baseReq({ query: {} }));
    expect(res.statusCode).toBe(200);
    const data = (res.body as any).data;
    expect(data.total).toBe(1);
    expect(data.data).toHaveLength(1);
  });

  it('GET / supports pagination', async () => {
    for (let i = 0; i < 3; i++) {
      const base = new Date(Date.now() + (i + 1) * 240 * 60_000);
      const start = new Date(base);
      start.setMinutes(0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60_000);
      await invokeRoute(blockedTimeRouter, 'post', '/', baseReq({ body: createBody({ description: `Slot ${i}`, startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() }) }));
    }

    const res = await invokeRoute(blockedTimeRouter, 'get', '/', baseReq({ query: { page: 1, pageSize: 2 } }));
    expect(res.statusCode).toBe(200);
    const data = (res.body as any).data;
    expect(data.data).toHaveLength(2);
    expect(data.total).toBe(3);
  });

  it('PATCH /:id updates a blocked time slot', async () => {
    const created = await invokeRoute(blockedTimeRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const res = await invokeRoute(
      blockedTimeRouter,
      'patch',
      `/${id}`,
      baseReq({ params: { id }, body: { description: 'Updated' } }),
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.description).toBe('Updated');
  });

  it('PATCH /:id returns 400 when body is empty', async () => {
    const created = await invokeRoute(blockedTimeRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const res = await invokeRoute(
      blockedTimeRouter,
      'patch',
      `/${id}`,
      baseReq({ params: { id }, body: {} }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('PATCH /:id returns 404 for non-owned blocked time slot', async () => {
    const other = await createTestUser();
    const { start, end } = appointmentTimeRange(120, 60);
    const otherBt = await prisma.blockedTime.create({
      data: { userId: other.id, description: 'Other', startTimeUtc: start, endTimeUtc: end },
    });

    const res = await invokeRoute(
      blockedTimeRouter,
      'patch',
      `/${otherBt.id}`,
      baseReq({ params: { id: otherBt.id }, body: { description: 'Hacked' } }),
    );
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /:id soft-deletes a blocked time slot', async () => {
    const created = await invokeRoute(blockedTimeRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const del = await invokeRoute(blockedTimeRouter, 'delete', `/${id}`, baseReq({ params: { id } }));
    expect(del.statusCode).toBe(200);
    expect((del.body as any).data.deleted).toBe(true);

    const raw = await prisma.blockedTime.findUnique({ where: { id } });
    expect(raw!.isDeleted).toBe(true);
  });

  it('DELETE /:id returns 404 for non-owned blocked time slot', async () => {
    const other = await createTestUser();
    const { start, end } = appointmentTimeRange(120, 60);
    const otherBt = await prisma.blockedTime.create({
      data: { userId: other.id, description: 'Other', startTimeUtc: start, endTimeUtc: end },
    });

    const res = await invokeRoute(
      blockedTimeRouter,
      'delete',
      `/${otherBt.id}`,
      baseReq({ params: { id: otherBt.id } }),
    );
    expect(res.statusCode).toBe(404);
  });

  it('POST /:id/restore restores a soft-deleted blocked time slot', async () => {
    const created = await invokeRoute(blockedTimeRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    await invokeRoute(blockedTimeRouter, 'delete', `/${id}`, baseReq({ params: { id } }));

    const restored = await invokeRoute(
      blockedTimeRouter,
      'post',
      `/${id}/restore`,
      baseReq({ params: { id } }),
    );
    expect(restored.statusCode).toBe(200);
    expect((restored.body as any).data.isDeleted).toBe(false);
  });

  it('POST / then GET /:id round-trips description', async () => {
    const { start, end } = appointmentTimeRange(120, 60);
    const created = await invokeRoute(
      blockedTimeRouter,
      'post',
      '/',
      baseReq({ body: { description: 'Roundtrip', startTimeUtc: start.toISOString(), endTimeUtc: end.toISOString() } }),
    );
    const id = (created.body as any).data.id;

    const fetched = await invokeRoute(blockedTimeRouter, 'get', `/${id}`, baseReq({ params: { id } }));
    expect((fetched.body as any).data.description).toBe('Roundtrip');
    expect((fetched.body as any).data.startTimeUtc).toBeTruthy();
    expect((fetched.body as any).data.endTimeUtc).toBeTruthy();
  });
});
