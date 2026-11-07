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

  describe('ENCRYPTION_KEY_PREVIOUS', () => {
    it('rejects a malformed value', async () => {
      vi.stubEnv('ENCRYPTION_KEY', HEX_A);
      vi.stubEnv('BLIND_INDEX_KEY', HEX_B);
      vi.stubEnv('ENCRYPTION_KEY_PREVIOUS', 'short');
      await expect(loadConfig()).rejects.toThrow('ENCRYPTION_KEY_PREVIOUS must be a 64-character hex string');
    });

    it('rejects a value equal to the current key, any case', async () => {
      vi.stubEnv('ENCRYPTION_KEY', HEX_A);
      vi.stubEnv('BLIND_INDEX_KEY', HEX_B);
      vi.stubEnv('ENCRYPTION_KEY_PREVIOUS', HEX_A.toUpperCase());
      await expect(loadConfig()).rejects.toThrow('ENCRYPTION_KEY_PREVIOUS must differ from ENCRYPTION_KEY');
    });

    it('rejects a value equal to the blind index key', async () => {
      vi.stubEnv('ENCRYPTION_KEY', HEX_A);
      vi.stubEnv('BLIND_INDEX_KEY', HEX_B);
      vi.stubEnv('ENCRYPTION_KEY_PREVIOUS', HEX_B);
      await expect(loadConfig()).rejects.toThrow('ENCRYPTION_KEY_PREVIOUS must differ from BLIND_INDEX_KEY');
    });

    it('rejects a previous key with no current key', async () => {
      vi.stubEnv('ENCRYPTION_KEY', '');
      vi.stubEnv('BLIND_INDEX_KEY', HEX_B);
      vi.stubEnv('ENCRYPTION_KEY_PREVIOUS', 'c'.repeat(64));
      await expect(loadConfig()).rejects.toThrow('ENCRYPTION_KEY_PREVIOUS requires ENCRYPTION_KEY');
    });

    it('treats a blank value as unset', async () => {
      vi.stubEnv('ENCRYPTION_KEY', HEX_A);
      vi.stubEnv('BLIND_INDEX_KEY', HEX_B);
      vi.stubEnv('ENCRYPTION_KEY_PREVIOUS', '  ');
      expect((await loadConfig()).encryption.previousKey).toBeUndefined();
    });

    it('exposes a valid previous key', async () => {
      vi.stubEnv('ENCRYPTION_KEY', HEX_A);
      vi.stubEnv('BLIND_INDEX_KEY', HEX_B);
      vi.stubEnv('ENCRYPTION_KEY_PREVIOUS', 'c'.repeat(64));
      expect((await loadConfig()).encryption.previousKey).toBe('c'.repeat(64));
    });
  });
});
