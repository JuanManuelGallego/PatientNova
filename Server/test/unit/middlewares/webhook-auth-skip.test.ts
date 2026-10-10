import { beforeEach, describe, expect, it, vi } from 'vitest';

const configMock = vi.hoisted(() => ({
  config: {
    skipWebhookAuth: false,
    brevo: { webhookSecret: 'brevo-secret' },
    twilio: { authToken: 'tw-token', webhookBaseUrl: 'https://api.example.com' },
  },
}));
vi.mock('../../../src/utils/config/config.js', () => configMock);
vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { twilioWebhookAuth } from '../../../src/middlewares/twilio-webhook-auth.js';
import { brevoWebhookAuth } from '../../../src/brevo/brevo-webhook-auth.js';

function makeRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.send = vi.fn(() => res);
  return res;
}

const unsignedReq = () => ({ headers: {}, body: {}, originalUrl: '/webhooks/x' }) as any;

describe.each([
  [ 'twilioWebhookAuth', twilioWebhookAuth ],
  [ 'brevoWebhookAuth', brevoWebhookAuth ],
])('%s skip switch', (_name, middleware) => {
  beforeEach(() => { configMock.config.skipWebhookAuth = false; });

  it('rejects unsigned requests unless the skip is explicitly enabled', () => {
    const res = makeRes();
    const next = vi.fn();
    middleware(unsignedReq(), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through only when skipWebhookAuth is true', () => {
    configMock.config.skipWebhookAuth = true;
    const res = makeRes();
    const next = vi.fn();
    middleware(unsignedReq(), res, next);
    expect(next).toHaveBeenCalled();
  });
});
