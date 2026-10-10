import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadConfig() {
  vi.resetModules();
  return (await import('../../../src/utils/config/config.js')).config;
}

describe('config.auth.portalJwtSecret', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rejects a portal secret equal to AUTH_SECRET', async () => {
    vi.stubEnv('AUTH_SECRET', 'shared-secret');
    vi.stubEnv('PORTAL_AUTH_SECRET', 'shared-secret');
    await expect(loadConfig()).rejects.toThrow('PORTAL_AUTH_SECRET must differ from AUTH_SECRET');
  });

  it('requires PORTAL_AUTH_SECRET when the portal is enabled', async () => {
    vi.stubEnv('ENABLE_PORTAL', 'true');
    vi.stubEnv('PORTAL_AUTH_SECRET', '');
    await expect(loadConfig()).rejects.toThrow('PORTAL_AUTH_SECRET');
  });

  it('accepts a distinct portal secret', async () => {
    vi.stubEnv('ENABLE_PORTAL', 'true');
    vi.stubEnv('PORTAL_AUTH_SECRET', 'distinct-portal-secret');
    expect((await loadConfig()).auth.portalJwtSecret).toBe('distinct-portal-secret');
  });
});

describe('config.skipWebhookAuth', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    [ '', 'true', false ], // unset (empty so dotenv does not refill it from .env)
    [ 'production', 'true', false ],
    [ 'development', undefined, false ],
    [ 'development', 'true', true ],
  ])('NODE_ENV=%s SKIP_WEBHOOK_AUTH=%s → %s', async (nodeEnv, skip, expected) => {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.stubEnv('SKIP_WEBHOOK_AUTH', skip);
    expect((await loadConfig()).skipWebhookAuth).toBe(expected);
  });
});
