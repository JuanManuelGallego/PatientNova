import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createTurnstileVerifier, isTurnstileTestSecret, TURNSTILE_SITEVERIFY_URL } from '../../../src/captcha/turnstile.js';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const fetchMock = vi.fn();

const verifier = createTurnstileVerifier({
  secret: 'turnstile-secret',
  expectedHostnames: [ 'portal.patientnova.net' ],
  timeoutMs: 3000,
  now: () => NOW,
});

function siteverify(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const valid = {
  success: true,
  'error-codes': [],
  challenge_ts: '2026-10-12T11:59:00Z',
  hostname: 'portal.patientnova.net',
  action: 'otp-request',
};

const check = (...args: [ token?: string ]) =>
  verifier.verify({ token: args.length ? args[ 0 ] : 'tok', ip: '203.0.113.7', action: 'otp-request' });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Turnstile verifier', () => {
  it('posts the secret, token and client IP to siteverify and accepts a matching response', async () => {
    fetchMock.mockResolvedValue(siteverify(valid));

    expect(await check()).toEqual({ ok: true });

    const [ url, init ] = fetchMock.mock.calls[ 0 ]!;
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual({ secret: 'turnstile-secret', response: 'tok', remoteip: '203.0.113.7' });
  });

  it('rejects missing and oversized tokens without calling the provider', async () => {
    expect(await check(undefined)).toEqual({ ok: false, reason: 'missing' });
    expect(await check('x'.repeat(2049))).toEqual({ ok: false, reason: 'invalid' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [ [ 'invalid-input-response' ], 'invalid' ],
    [ [ 'timeout-or-duplicate' ], 'expired' ],
    [ [ 'missing-input-response' ], 'missing' ],
    [ [ 'invalid-input-secret' ], 'unavailable' ],
    [ [ 'internal-error' ], 'unavailable' ],
    [ [], 'invalid' ],
  ])('maps error codes %j to %s', async (codes, reason) => {
    fetchMock.mockResolvedValue(siteverify({ success: false, 'error-codes': codes }));
    expect(await check()).toEqual({ ok: false, reason });
  });

  it('rejects tokens solved on another hostname or for another action', async () => {
    fetchMock.mockResolvedValueOnce(siteverify({ ...valid, hostname: 'evil.example' }));
    expect(await check()).toEqual({ ok: false, reason: 'hostname-mismatch' });

    fetchMock.mockResolvedValueOnce(siteverify({ ...valid, action: 'booking-create' }));
    expect(await check()).toEqual({ ok: false, reason: 'action-mismatch' });
  });

  it('skips hostname and action only for responses Cloudflare marks as test-key results', async () => {
    // What siteverify actually answers for the always-pass test secret (checked 2026-11-01).
    const testKey = { success: true, 'error-codes': [], challenge_ts: '2026-10-12T11:59:00Z', hostname: 'example.com', metadata: { result_with_testing_key: true } };
    fetchMock.mockResolvedValueOnce(siteverify(testKey));
    expect(await check()).toEqual({ ok: true });

    fetchMock.mockResolvedValueOnce(siteverify({ ...testKey, challenge_ts: '2026-10-12T11:54:00Z' }));
    expect(await check()).toEqual({ ok: false, reason: 'expired' });

    fetchMock.mockResolvedValueOnce(siteverify({ ...testKey, metadata: { result_with_testing_key: false } }));
    expect(await check()).toEqual({ ok: false, reason: 'hostname-mismatch' });

    fetchMock.mockResolvedValueOnce(siteverify({ ...testKey, success: false, 'error-codes': [ 'invalid-input-response' ] }));
    expect(await check()).toEqual({ ok: false, reason: 'invalid' });
  });

  it('recognizes the Cloudflare test secrets', () => {
    expect(isTurnstileTestSecret('1x0000000000000000000000000000000AA')).toBe(true);
    expect(isTurnstileTestSecret('2x0000000000000000000000000000000AA')).toBe(true);
    expect(isTurnstileTestSecret('0x4AAAAAAAreal-secret')).toBe(false);
  });

  it('rejects stale or undated challenges', async () => {
    fetchMock.mockResolvedValueOnce(siteverify({ ...valid, challenge_ts: '2026-10-12T11:54:00Z' }));
    expect(await check()).toEqual({ ok: false, reason: 'expired' });

    fetchMock.mockResolvedValueOnce(siteverify({ ...valid, challenge_ts: undefined }));
    expect(await check()).toEqual({ ok: false, reason: 'expired' });
  });

  it('treats network errors, timeouts and non-2xx responses as unavailable (fail closed)', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    expect(await check()).toEqual({ ok: false, reason: 'unavailable' });

    fetchMock.mockResolvedValueOnce(new Response('bad gateway', { status: 502 }));
    expect(await check()).toEqual({ ok: false, reason: 'unavailable' });

    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    expect(await check()).toEqual({ ok: false, reason: 'unavailable' });
  });
});
