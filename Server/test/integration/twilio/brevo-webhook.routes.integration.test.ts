import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the events service so this test isolates the auth middleware + routing
// (status codes, rejection) rather than DB side effects.
const processMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../src/twilio/brevo-webhook.service.js', () => ({
  processBrevoEvents: (...args: unknown[]) => processMock(...args),
}));

import { config } from '../../../src/utils/config/config.js';
import { brevoWebhookRouter } from '../../../src/twilio/brevo-webhook.routes.js';
import { invokeRoute } from '../helpers.js';

const PATH = '/events';
const SECRET = config.brevo.webhookSecret;
const EVENT = { event: 'delivered', email: 'maria@example.com', 'message-id': '<abc@smtp-relay.mailin.fr>' };

function basic(user: string, password: string) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

beforeEach(() => {
  processMock.mockClear();
});

describe('brevo webhook route (integration, shared-secret auth)', () => {
  it('accepts a valid Bearer secret and processes a single event', async () => {
    const res = await invokeRoute(brevoWebhookRouter, 'post', PATH, {
      originalUrl: PATH,
      headers: { authorization: `Bearer ${SECRET}` },
      body: EVENT,
    });

    expect(res.statusCode).toBe(200);
    expect(processMock).toHaveBeenCalledWith([ EVENT ]);
  });

  it('accepts Basic auth whose password is the secret and processes a batch', async () => {
    const res = await invokeRoute(brevoWebhookRouter, 'post', PATH, {
      originalUrl: PATH,
      headers: { authorization: basic('brevo', SECRET) },
      body: [ EVENT, { ...EVENT, event: 'opened' } ] as any,
    });

    expect(res.statusCode).toBe(200);
    expect(processMock).toHaveBeenCalledWith([ EVENT, { ...EVENT, event: 'opened' } ]);
  });

  it('rejects a request without credentials (403)', async () => {
    const res = await invokeRoute(brevoWebhookRouter, 'post', PATH, {
      originalUrl: PATH,
      headers: {},
      body: EVENT,
    });

    expect(res.statusCode).toBe(403);
    expect(processMock).not.toHaveBeenCalled();
  });

  it('rejects a wrong Bearer secret (403)', async () => {
    const res = await invokeRoute(brevoWebhookRouter, 'post', PATH, {
      originalUrl: PATH,
      headers: { authorization: 'Bearer not-the-secret' },
      body: EVENT,
    });

    expect(res.statusCode).toBe(403);
    expect(processMock).not.toHaveBeenCalled();
  });

  it('rejects Basic auth with a wrong password (403)', async () => {
    const res = await invokeRoute(brevoWebhookRouter, 'post', PATH, {
      originalUrl: PATH,
      headers: { authorization: basic('brevo', 'nope') },
      body: EVENT,
    });

    expect(res.statusCode).toBe(403);
    expect(processMock).not.toHaveBeenCalled();
  });

  it('rejects an unsupported auth scheme (403)', async () => {
    const res = await invokeRoute(brevoWebhookRouter, 'post', PATH, {
      originalUrl: PATH,
      headers: { authorization: `Token ${SECRET}` },
      body: EVENT,
    });

    expect(res.statusCode).toBe(403);
    expect(processMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an authenticated non-object payload', async () => {
    const res = await invokeRoute(brevoWebhookRouter, 'post', PATH, {
      originalUrl: PATH,
      headers: { authorization: `Bearer ${SECRET}` },
      body: 'not-json' as any,
    });

    expect(res.statusCode).toBe(400);
    expect(processMock).not.toHaveBeenCalled();
  });
});
