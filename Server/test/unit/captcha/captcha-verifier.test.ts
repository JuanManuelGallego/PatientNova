import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createCaptchaVerifier, devBypassCaptchaVerifier } from '../../../src/captcha/captcha-verifier.js';

const none = { provider: 'none' as const, secret: '', expectedHostnames: [ 'localhost' ], timeoutMs: 3000 };

describe('createCaptchaVerifier', () => {
  it('refuses to fall back to the bypass verifier in production', () => {
    expect(() => createCaptchaVerifier(none, 'production')).toThrow('CAPTCHA provider');
  });

  it('uses the bypass verifier outside production, which still requires a token', async () => {
    const verifier = createCaptchaVerifier(none, 'development');
    expect(verifier).toBe(devBypassCaptchaVerifier);
    expect(await verifier.verify({ token: undefined, ip: undefined, action: 'a' })).toEqual({ ok: false, reason: 'missing' });
    expect(await verifier.verify({ token: 'anything', ip: undefined, action: 'a' })).toEqual({ ok: true });
  });

  it('builds a Turnstile verifier when configured, even in production', () => {
    const verifier = createCaptchaVerifier({ ...none, provider: 'turnstile', secret: 's' }, 'production');
    expect(verifier).not.toBe(devBypassCaptchaVerifier);
  });
});

describe('config.captcha', () => {
  async function loadConfig() {
    vi.resetModules();
    return (await import('../../../src/utils/config/config.js')).config;
  }

  afterEach(() => vi.unstubAllEnvs());

  it('requires a provider when the portal is enabled in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENCRYPTION_KEY', 'a'.repeat(64));
    vi.stubEnv('ENABLE_PORTAL', 'true');
    vi.stubEnv('CAPTCHA_PROVIDER', '');
    await expect(loadConfig()).rejects.toThrow('CAPTCHA_PROVIDER is required');
  });

  it('requires CAPTCHA_SECRET once a provider is chosen', async () => {
    vi.stubEnv('CAPTCHA_PROVIDER', 'turnstile');
    vi.stubEnv('CAPTCHA_SECRET', '');
    await expect(loadConfig()).rejects.toThrow('CAPTCHA_SECRET');
  });

  it('rejects unknown providers', async () => {
    vi.stubEnv('CAPTCHA_PROVIDER', 'recaptcha');
    await expect(loadConfig()).rejects.toThrow('Unsupported CAPTCHA_PROVIDER');
  });

  it('defaults the expected hostname to the portal URL and accepts an explicit list', async () => {
    vi.stubEnv('PORTAL_URL', 'https://portal.patientnova.net');
    vi.stubEnv('CAPTCHA_EXPECTED_HOSTNAMES', '');
    expect((await loadConfig()).captcha.expectedHostnames).toEqual([ 'portal.patientnova.net' ]);

    vi.stubEnv('CAPTCHA_EXPECTED_HOSTNAMES', 'a.example, b.example');
    expect((await loadConfig()).captcha.expectedHostnames).toEqual([ 'a.example', 'b.example' ]);
  });
});
