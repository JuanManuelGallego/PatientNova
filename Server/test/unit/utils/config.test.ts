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
