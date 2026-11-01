import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createCaptchaVerifier } from '../../../src/captcha/captcha-verifier.js';
import { TURNSTILE_SITEVERIFY_URL } from '../../../src/captcha/turnstile.js';

describe('createCaptchaVerifier', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('always verifies with Turnstile using the configured secret (no bypass)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, 'error-codes': [ 'invalid-input-response' ] })));
    vi.stubGlobal('fetch', fetchMock);

    const verifier = createCaptchaVerifier({ secret: 's3cret', expectedHostnames: [ 'localhost' ], timeoutMs: 3000 });
    expect(await verifier.verify({ token: 'anything', ip: undefined, action: 'a' })).toEqual({ ok: false, reason: 'invalid' });

    const [ url, init ] = fetchMock.mock.calls[ 0 ]!;
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    expect(JSON.parse(init.body as string)).toMatchObject({ secret: 's3cret', response: 'anything' });
  });

  it('warns once when production runs with a Cloudflare test secret', async () => {
    vi.resetModules();
    vi.doMock('../../../src/utils/config/config.js', () => ({ config: { env: 'production', captcha: {} } }));
    try {
      const { logger } = await import('../../../src/utils/api/logger.js');
      const fresh = await import('../../../src/captcha/captcha-verifier.js');
      vi.mocked(logger.warn).mockClear();
      const testSecret = { secret: '1x0000000000000000000000000000000AA', expectedHostnames: [ 'localhost' ], timeoutMs: 3000 };
      fresh.createCaptchaVerifier(testSecret);
      fresh.createCaptchaVerifier(testSecret);
      fresh.createCaptchaVerifier({ ...testSecret, secret: 'real-secret' });
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(vi.mocked(logger.warn).mock.calls[ 0 ]![ 0 ]).toMatch(/test secret/);
    } finally {
      vi.doUnmock('../../../src/utils/config/config.js');
      vi.resetModules();
    }
  });
});

describe('config.captcha', () => {
  async function loadConfig() {
    vi.resetModules();
    return (await import('../../../src/utils/config/config.js')).config;
  }

  afterEach(() => vi.unstubAllEnvs());

  it('requires CAPTCHA_SECRET in every environment', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CAPTCHA_SECRET', '');
    await expect(loadConfig()).rejects.toThrow('CAPTCHA_SECRET');
  });

  it('defaults the expected hostname to the portal URL and accepts an explicit list', async () => {
    vi.stubEnv('PORTAL_URL', 'https://portal.patientnova.net');
    vi.stubEnv('CAPTCHA_EXPECTED_HOSTNAMES', '');
    expect((await loadConfig()).captcha.expectedHostnames).toEqual([ 'portal.patientnova.net' ]);

    vi.stubEnv('CAPTCHA_EXPECTED_HOSTNAMES', 'a.example, b.example');
    expect((await loadConfig()).captcha.expectedHostnames).toEqual([ 'a.example', 'b.example' ]);
  });
});
