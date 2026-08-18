import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the status callback service so this test isolates the auth middleware +
// routing (status codes, signature rejection) rather than DB side effects.
const processMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../src/twilio/message-status.service.js', () => ({
  processMessageStatusCallback: (...args: unknown[]) => processMock(...args),
}));

import twilio from 'twilio';
import { config } from '../../../src/utils/config/config.js';
import { twilioWebhookRouter } from '../../../src/twilio/webhook.routes.js';
import { invokeRoute } from '../helpers.js';

const BASE_URL = config.twilio.webhookBaseUrl;
const PATH = '/status';

beforeEach(() => {
  processMock.mockClear();
});

function signedBody(body: Record<string, string>) {
  const signature = twilio.getExpectedTwilioSignature(config.twilio.authToken, `${BASE_URL}${PATH}`, body);
  return { 'x-twilio-signature': signature };
}

describe('twilio status callback route (integration, auth middleware)', () => {
  it('accepts a valid signature and processes the callback', async () => {
    const body = { MessageSid: 'SMabc', MessageStatus: 'delivered', ErrorCode: '', ErrorMessage: '' };
    const res = await invokeRoute(twilioWebhookRouter, 'post', PATH, {
      originalUrl: PATH,
      headers: signedBody(body),
      body,
    });

    expect(res.statusCode).toBe(200);
    expect(processMock).toHaveBeenCalledWith(
      expect.objectContaining({ messageSid: 'SMabc', messageStatus: 'delivered' }),
    );
  });

  it('rejects a request with no X-Twilio-Signature (403)', async () => {
    const body = { MessageSid: 'SMabc', MessageStatus: 'delivered' };
    const res = await invokeRoute(twilioWebhookRouter, 'post', PATH, {
      originalUrl: PATH,
      headers: {},
      body,
    });

    expect(res.statusCode).toBe(403);
    expect(processMock).not.toHaveBeenCalled();
  });

  it('rejects a request with an invalid signature (403)', async () => {
    const body = { MessageSid: 'SMabc', MessageStatus: 'delivered' };
    const res = await invokeRoute(twilioWebhookRouter, 'post', PATH, {
      originalUrl: PATH,
      headers: { 'x-twilio-signature': 'bogus' },
      body,
    });

    expect(res.statusCode).toBe(403);
    expect(processMock).not.toHaveBeenCalled();
  });

  it('rejects a tampered body that no longer matches the signature (403)', async () => {
    const body = { MessageSid: 'SMabc', MessageStatus: 'delivered' };
    const headers = signedBody(body);
    const res = await invokeRoute(twilioWebhookRouter, 'post', PATH, {
      originalUrl: PATH,
      headers,
      body: { MessageSid: 'SMother', MessageStatus: 'delivered' },
    });

    expect(res.statusCode).toBe(403);
    expect(processMock).not.toHaveBeenCalled();
  });
});
