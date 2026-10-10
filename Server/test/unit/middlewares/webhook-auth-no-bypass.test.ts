import { afterEach, describe, expect, it, vi } from 'vitest';

const configMock = vi.hoisted(() => ({
  config: {
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
])('%s has no bypass', (_name, middleware) => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([ 'development', 'test', 'production', '' ])('rejects unsigned requests with NODE_ENV=%s', (nodeEnv) => {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.stubEnv('SKIP_WEBHOOK_AUTH', 'true');
    const res = makeRes();
    const next = vi.fn();
    middleware(unsignedReq(), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});
