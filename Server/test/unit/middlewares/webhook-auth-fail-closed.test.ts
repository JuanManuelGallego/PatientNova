import { beforeEach, describe, expect, it, vi } from 'vitest';

const cfg = vi.hoisted(() => ({
  env: 'production',
  brevo: { webhookSecret: 'brevo-secret' },
  twilio: { authToken: 'tok', webhookBaseUrl: 'https://example.com' },
}));

vi.mock('../../../src/utils/config/config.js', () => ({ config: cfg }));
vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { brevoWebhookAuth } from '../../../src/brevo/brevo-webhook-auth.js';
import { twilioWebhookAuth } from '../../../src/middlewares/twilio-webhook-auth.js';

function res() {
  const r: any = { statusCode: 200 };
  r.status = vi.fn((c: number) => { r.statusCode = c; return r; });
  r.send = vi.fn(() => r);
  r.json = vi.fn(() => r);
  return r;
}
const req = (headers: Record<string, string> = {}) => ({ headers, originalUrl: '/webhooks/x', body: {} }) as any;

describe('webhook authentication fails closed', () => {
  beforeEach(() => { cfg.env = 'production'; });

  it('rejects unauthenticated Brevo webhooks unless NODE_ENV is explicitly development', () => {
    for (const env of [ 'production', 'test', 'staging' ]) {
      cfg.env = env;
      const next = vi.fn();
      const r = res();
      brevoWebhookAuth(req(), r, next);
      expect(r.statusCode, env).toBe(403);
      expect(next, env).not.toHaveBeenCalled();
    }
    cfg.env = 'development';
    const next = vi.fn();
    brevoWebhookAuth(req(), res(), next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects Twilio webhooks without a signature unless explicitly development', () => {
    for (const env of [ 'production', 'test' ]) {
      cfg.env = env;
      const next = vi.fn();
      const r = res();
      twilioWebhookAuth(req(), r, next);
      expect(r.statusCode, env).toBe(403);
      expect(next, env).not.toHaveBeenCalled();
    }
  });
});
