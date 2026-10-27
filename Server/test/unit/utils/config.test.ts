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

describe('config.encryption', () => {
  afterEach(() => vi.unstubAllEnvs());
  const HEX_A = 'a'.repeat(64);
  const HEX_B = 'b'.repeat(64);

  it('rejects a malformed ENCRYPTION_KEY at boot', async () => {
    vi.stubEnv('ENCRYPTION_KEY', 'z'.repeat(64));
    vi.stubEnv('BLIND_INDEX_KEY', HEX_B);
    await expect(loadConfig()).rejects.toThrow('ENCRYPTION_KEY must be a 64-character hex string');
  });

  it('rejects a malformed BLIND_INDEX_KEY at boot', async () => {
    vi.stubEnv('ENCRYPTION_KEY', HEX_A);
    vi.stubEnv('BLIND_INDEX_KEY', 'short');
    await expect(loadConfig()).rejects.toThrow('BLIND_INDEX_KEY must be a 64-character hex string');
  });

  it('rejects the same key for encryption and blind indexes', async () => {
    vi.stubEnv('ENCRYPTION_KEY', HEX_A);
    vi.stubEnv('BLIND_INDEX_KEY', HEX_A.toUpperCase());
    await expect(loadConfig()).rejects.toThrow('BLIND_INDEX_KEY must differ from ENCRYPTION_KEY');
  });

  it('accepts two distinct hex keys', async () => {
    vi.stubEnv('ENCRYPTION_KEY', HEX_A);
    vi.stubEnv('BLIND_INDEX_KEY', HEX_B);
    expect((await loadConfig()).encryption).toEqual({ key: HEX_A, blindIndexKey: HEX_B });
  });
});
