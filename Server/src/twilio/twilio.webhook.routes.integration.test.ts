import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the webhook service so this test isolates the auth middleware + routing
// behavior (status codes, signature rejection) rather than DB side effects.
const processMock = vi.fn().mockResolvedValue({ success: true });
vi.mock('./twilio-webhook.service.js', () => ({
  twilioWebhookService: {
    processWhatsAppReply: (...args: unknown[]) => processMock(...args),
  },
}));

import twilio from 'twilio';
import { prisma } from '../prisma/prismaClient.js';
import { twilioWebhookRouter } from './twilio.webhook.routes.js';
import { createTestUser, createTestPatient, createTestLocation, createTestAppointmentType, appointmentTimeRange, invokeRoute } from '../../test/integration/helpers.js';
import { AppointmentStatus } from '../../generated/prisma/client.ts';

const AUTH_TOKEN = 'dummyToken';
const BASE_URL = 'https://example.com/twilio';
const PATH = '/';
const FROM = 'whatsapp:+57300123456';

beforeEach(async () => {
  processMock.mockClear();
  const userId = (await createTestUser()).id;
  const patientId = (await createTestPatient(userId)).id;
  const loc = await createTestLocation(userId);
  const type = await createTestAppointmentType(userId);
  const { start, end } = appointmentTimeRange(120, 30);
  await prisma.appointment.create({
    data: {
      startAt: start,
      endAt: end,
      price: 0,
      status: AppointmentStatus.SCHEDULED,
      patientId,
      userId,
      locationId: loc.id,
      typeId: type.id,
    },
  });
});

function signedBody(body: Record<string, string>) {
  // Reproduce the exact signature Twilio would send for these POST params.
  const signature = twilio.getExpectedTwilioSignature(AUTH_TOKEN, `${BASE_URL}${PATH}`, body);
  return { 'x-twilio-signature': signature };
}

describe('twilio webhook route (integration, auth middleware)', () => {
  it('accepts a valid signature and processes the reply', async () => {
    const body = { From: FROM, ButtonPayload: 'confirm' };
    const res = await invokeRoute(
      twilioWebhookRouter,
      'post',
      PATH,
      { originalUrl: PATH, headers: signedBody(body), body },
    );

    expect(res.statusCode).toBe(200);
    expect(processMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: FROM, buttonPayload: 'confirm' }),
    );
  });

  it('rejects a request with no X-Twilio-Signature (403)', async () => {
    const body = { From: FROM, ButtonPayload: 'confirm' };
    const res = await invokeRoute(
      twilioWebhookRouter,
      'post',
      PATH,
      { originalUrl: PATH, headers: {}, body },
    );

    expect(res.statusCode).toBe(403);
    expect(processMock).not.toHaveBeenCalled();
    expect(res.body).toBe('Forbidden');
  });

  it('rejects a request with an invalid signature (403)', async () => {
    const body = { From: FROM, ButtonPayload: 'confirm' };
    const res = await invokeRoute(
      twilioWebhookRouter,
      'post',
      PATH,
      { originalUrl: PATH, headers: { 'x-twilio-signature': 'bogus' }, body },
    );

    expect(res.statusCode).toBe(403);
    expect(processMock).not.toHaveBeenCalled();
  });

  it('rejects a tampered body that no longer matches the signature (403)', async () => {
    const body = { From: FROM, ButtonPayload: 'confirm' };
    const headers = signedBody(body);
    // Send a different payload than the one that was signed.
    const res = await invokeRoute(
      twilioWebhookRouter,
      'post',
      PATH,
      { originalUrl: PATH, headers, body: { From: FROM, ButtonPayload: 'cancel' } },
    );

    expect(res.statusCode).toBe(403);
    expect(processMock).not.toHaveBeenCalled();
  });

  it('still returns 200 for an unknown intent (Twilio expects a response)', async () => {
    const body = { From: FROM, ButtonPayload: 'hello' };
    const res = await invokeRoute(
      twilioWebhookRouter,
      'post',
      PATH,
      { originalUrl: PATH, headers: signedBody(body), body },
    );

    expect(res.statusCode).toBe(200);
    expect(processMock).toHaveBeenCalled();
  });
});
