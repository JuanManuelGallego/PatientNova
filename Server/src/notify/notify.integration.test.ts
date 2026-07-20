import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Twilio SDK boundary so no real network calls are made.
vi.mock('../twilio/twilioClient.js', () => ({
  sendWhatsApp: vi.fn().mockResolvedValue({ success: true, messageSid: 'SMwhatsapp', channel: 'WHATSAPP', to: '+57300123456' }),
  sendSms: vi.fn().mockResolvedValue({ success: true, messageSid: 'SMsms', channel: 'SMS', to: '+57300123456' }),
  sendWhatsAppFreeForm: vi.fn().mockResolvedValue({ success: true, messageSid: 'SMfreeform', channel: 'WHATSAPP', to: '+57300123456' }),
  getMessageStatus: vi.fn().mockResolvedValue({ sid: 'SMx', status: 'delivered' }),
}));

// Mock the scheduler job manager so no pg-boss worker/pool interferes with the
// Prisma $transaction used by reminderService.create in these routes.
vi.mock('../scheduler/reminderJobManager.js', () => ({
  reminderJobManager: {
    enqueue: vi.fn().mockResolvedValue(undefined),
    enqueueImmediate: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    reschedule: vi.fn().mockResolvedValue(undefined),
    hasQueuedJob: vi.fn().mockResolvedValue(false),
  },
}));

import { prisma } from '../prisma/prismaClient.js';
import { notifyRouter } from './notify.routes.js';
import { createTestUser, createTestPatient } from '../../test/integration/helpers.js';
import { ReminderStatus, Channel } from '../../generated/prisma/client.ts';

let userId: string;
let patientId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
});

// Minimal Express request/response doubles.
function makeRes() {
  const res: any = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader() {
      return this;
    },
    send() {
      return this;
    },
  };
  return res;
}

// Runs the full Express middleware stack for a route (validateBody + async
// handler). asyncHandler swallows thrown errors and writes them to `res` via
// handleError, so we flush microtasks and then inspect `res` for the outcome.
async function invoke(method: 'post', path: string, req: any, res: any) {
  const layer: any = notifyRouter.stack.find((l: any) => {
    const route = l.route;
    return route && route.path === path && route.methods[method];
  });
  if (!layer) throw new Error(`No handler for ${method.toUpperCase()} ${path}`);

  const handlers = layer.route.stack as { handle: (req: any, res: any, next: any) => unknown }[];
  const next = () => undefined;

  for (const h of handlers) {
    h.handle(req, res, next);
  }
  // The async handler chain resolves on the microtask/timer queue; poll until
  // the response is settled (asyncHandler does not surface its promise).
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (res.statusCode !== 0) break;
  }
}

describe('notify routes (integration, mocked Twilio)', () => {
  it('POST /whatsapp creates a reminder, sends, and marks it SENT', async () => {
    const req = {
      user: { id: userId },
      body: { to: '+57300123456', contentSid: 'HXdummy', contentVariables: { '1': 'Maria' }, patientId },
      params: {},
      ip: '127.0.0.1',
    };
    const res = makeRes();

    await invoke('post', '/whatsapp', req as any, res);

    expect(res.statusCode).toBe(201);
    expect((res.body as any).data.messageSid).toBe('SMwhatsapp');

    const reminder = await prisma.reminder.findFirst({ where: { userId, channel: Channel.WHATSAPP } });
    expect(reminder).toBeTruthy();
    expect(reminder!.status).toBe(ReminderStatus.SENT);
    expect(reminder!.messageId).toBe('SMwhatsapp');
  });

  it('POST /sms creates a reminder, sends, and marks it SENT', async () => {
    const req = {
      user: { id: userId },
      body: { to: '+57300123456', body: 'Hello', patientId },
      params: {},
      ip: '127.0.0.1',
    };
    const res = makeRes();

    await invoke('post', '/sms', req as any, res);

    expect(res.statusCode).toBe(201);
    expect((res.body as any).data.messageSid).toBe('SMsms');

    const reminder = await prisma.reminder.findFirst({ where: { userId, channel: Channel.SMS } });
    expect(reminder).toBeTruthy();
    expect(reminder!.status).toBe(ReminderStatus.SENT);
  });

  it('rejects when the linked patient is not owned by the user', async () => {
    const otherPatient = await createTestPatient((await createTestUser()).id);

    const req = {
      user: { id: userId },
      body: { to: '+57300123456', contentSid: 'HXdummy', patientId: otherPatient.id },
      params: {},
      ip: '127.0.0.1',
    };
    const res = makeRes();

    await invoke('post', '/whatsapp', req as any, res);

    expect(res.statusCode).toBe(404);
    const reminder = await prisma.reminder.findFirst({ where: { userId, patientId: otherPatient.id } });
    expect(reminder).toBeNull();
  });

  it('marks the reminder FAILED when the Twilio send throws', async () => {
    const { sendWhatsApp } = await import('../twilio/twilioClient.js');
    (sendWhatsApp as any).mockRejectedValueOnce(new Error('Twilio down'));

    const req = {
      user: { id: userId },
      body: { to: '+57300123456', contentSid: 'HXdummy', patientId },
      params: {},
      ip: '127.0.0.1',
    };
    const res = makeRes();

    await invoke('post', '/whatsapp', req as any, res);

    expect(res.statusCode).toBe(500);
    const reminder = await prisma.reminder.findFirst({ where: { userId, channel: Channel.WHATSAPP } });
    expect(reminder).toBeTruthy();
    expect(reminder!.status).toBe(ReminderStatus.FAILED);
    expect(reminder!.error).toBe('Twilio down');
  });
});
