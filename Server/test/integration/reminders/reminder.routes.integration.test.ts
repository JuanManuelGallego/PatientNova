import { describe, it, expect, beforeEach, vi } from 'vitest';

// The reminder route's create path enqueues to pg-boss (getBoss().send).
// Mock the boss so no real queue/connection is used in this route test.
vi.mock('../../../src/scheduler/pg-boss.js', () => ({
  getBoss: () => ({
    send: vi.fn().mockResolvedValue(undefined),
  }),
}));

// update/cancel touch the job manager; mock it to avoid a live pg-boss instance.
vi.mock('../../../src/scheduler/reminder-job-manager.js', () => ({
  reminderJobManager: {
    enqueue: vi.fn().mockResolvedValue(undefined),
    enqueueImmediate: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    reschedule: vi.fn().mockResolvedValue(undefined),
    hasQueuedJob: vi.fn().mockResolvedValue(false),
  },
}));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { reminderRouter } from '../../../src/reminders/reminder.routes.js';
import { createTestUser, createTestPatient, futureDate, invokeRoute } from '../helpers.js';
import { Channel, ReminderMode, ReminderStatus } from '../../../generated/prisma/client.ts';

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

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    channel: Channel.WHATSAPP,
    to: '+57300123456',
    sendMode: ReminderMode.SCHEDULED,
    sendAt: futureDate(120).toISOString(),
    status: ReminderStatus.PENDING,
    patientId,
    contentSid: 'HXdummy',
    ...overrides,
  };
}

describe('reminder routes (integration)', () => {
  it('POST / creates a reminder and returns 201', async () => {
    const res = await invokeRoute(reminderRouter, 'post', '/', baseReq({ body: createBody() }));
    expect(res.statusCode).toBe(201);
    const id = (res.body as any).data.id;
    expect(id).toBeTruthy();

    const stored = await prisma.reminder.findUnique({ where: { id } });
    expect(stored!.userId).toBe(userId);
    expect(stored!.status).toBe(ReminderStatus.PENDING);
  });

  it('POST / returns 400 when sendAt is missing for SCHEDULED mode', async () => {
    const { sendAt, ...rest } = createBody();
    const res = await invokeRoute(reminderRouter, 'post', '/', baseReq({ body: rest }));
    expect(res.statusCode).toBe(400);
  });

  it('GET /:id returns the reminder', async () => {
    const created = await invokeRoute(reminderRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const res = await invokeRoute(reminderRouter, 'get', `/${id}`, baseReq({ params: { id } }));
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.id).toBe(id);
  });

  it('GET /:id returns 404 for a non-owned reminder', async () => {
    const otherPatient = await createTestPatient((await createTestUser()).id);
    const reminder = await prisma.reminder.create({
      data: {
        channel: Channel.SMS,
        to: '+57300123456',
        sendMode: ReminderMode.IMMEDIATE,
        sendAt: futureDate(60),
        status: ReminderStatus.PENDING,
        patientId: otherPatient.id,
        userId: otherPatient.userId,
      },
    });

    const res = await invokeRoute(
      reminderRouter,
      'get',
      `/${reminder.id}`,
      baseReq({ params: { id: reminder.id } }),
    );
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /:id updates the reminder', async () => {
    const created = await invokeRoute(reminderRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const res = await invokeRoute(
      reminderRouter,
      'patch',
      `/${id}`,
      baseReq({ params: { id }, body: { body: 'Updated text' } }),
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.body).toBe('Updated text');
  });

  it('POST /:id/cancel cancels a PENDING reminder', async () => {
    const created = await invokeRoute(reminderRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const res = await invokeRoute(
      reminderRouter,
      'post',
      `/${id}/cancel`,
      baseReq({ params: { id } }),
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.status).toBe(ReminderStatus.CANCELLED);
  });

  it('DELETE /:id soft-deletes and PATCH /:id/restore recovers it', async () => {
    const created = await invokeRoute(reminderRouter, 'post', '/', baseReq({ body: createBody() }));
    const id = (created.body as any).data.id;

    const del = await invokeRoute(reminderRouter, 'delete', `/${id}`, baseReq({ params: { id } }));
    expect(del.statusCode).toBe(200);
    expect((del.body as any).data.deleted).toBe(true);

    const raw = await prisma.reminder.findUnique({ where: { id } });
    expect(raw!.isDeleted).toBe(true);

    const restored = await invokeRoute(
      reminderRouter,
      'patch',
      `/${id}/restore`,
      baseReq({ params: { id } }),
    );
    expect(restored.statusCode).toBe(200);
    expect((restored.body as any).data.isDeleted).toBe(false);
  });

  it('GET /stats aggregates by status and channel', async () => {
    await invokeRoute(reminderRouter, 'post', '/', baseReq({ body: createBody() }));
    const res = await invokeRoute(reminderRouter, 'get', '/stats', baseReq({ query: {} }));
    expect(res.statusCode).toBe(200);
    const stats = (res.body as any).data;
    expect(stats.total).toBe(1);
    expect(stats.byStatus[ReminderStatus.PENDING]).toBe(1);
    expect(stats.byChannel[Channel.WHATSAPP]).toBe(1);
  });
});
