import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadKeyring() {
  vi.resetModules();
  const { activeKeyring } = await import('../../../src/utils/encryption/keyring.js');
  const { keyId } = await import('../../../src/utils/encryption/field-encryption.js');
  return { activeKeyring, keyId };
}

describe('activeKeyring', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is null when ENCRYPTION_KEY is blank outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ENCRYPTION_KEY', '');
    const { activeKeyring } = await loadKeyring();
    expect(activeKeyring()).toBeNull();
  });

  it('builds the keyring once from the configured key', async () => {
    const key = 'a'.repeat(64);
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ENCRYPTION_KEY', key);
    const { activeKeyring, keyId } = await loadKeyring();
    const first = activeKeyring();
    expect(first).not.toBeNull();
    expect(activeKeyring()).toBe(first);
    expect(first!.currentId).toBe(keyId(key));
  });
});
