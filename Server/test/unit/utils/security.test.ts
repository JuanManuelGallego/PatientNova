import { describe, expect, it } from 'vitest';
import { safeEqual } from '../../../src/utils/security/safe-equal.js';
import {
  ONE_TIME_CODE_DEFAULTS,
  areAttemptsExhausted,
  canResend,
  generateNumericCode,
  hashOneTimeCode,
  isCodeExpired,
  verifyOneTimeCode,
} from '../../../src/utils/security/one-time-code.js';
import { createCsrfToken, verifyCsrfToken } from '../../../src/utils/security/csrf.js';

describe('safeEqual', () => {
  it('compares equal and different strings, including different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});

describe('one-time codes', () => {
  it('generates zero-padded numeric codes of the requested length', () => {
    for (let i = 0; i < 200; i++) expect(generateNumericCode()).toMatch(/^\d{6}$/);
    expect(generateNumericCode(8)).toMatch(/^\d{8}$/);
    expect(() => generateNumericCode(3)).toThrow(RangeError);
    expect(() => generateNumericCode(11)).toThrow(RangeError);
  });

  it('verifies only the right code for the same context and secret', () => {
    const hash = hashOneTimeCode('123456', 'provider-1:a@b.co', 'secret');
    expect(verifyOneTimeCode('123456', 'provider-1:a@b.co', 'secret', hash)).toBe(true);
    expect(verifyOneTimeCode('654321', 'provider-1:a@b.co', 'secret', hash)).toBe(false);
    expect(verifyOneTimeCode('123456', 'provider-2:a@b.co', 'secret', hash)).toBe(false);
    expect(verifyOneTimeCode('123456', 'provider-1:a@b.co', 'other-secret', hash)).toBe(false);
    expect(hash).not.toContain('123456');
  });

  it('handles expiry, attempt caps and resend cooldown', () => {
    const now = new Date('2026-10-06T12:00:00Z');
    expect(isCodeExpired(new Date('2026-10-06T12:00:00Z'), now)).toBe(true);
    expect(isCodeExpired(new Date('2026-10-06T12:00:01Z'), now)).toBe(false);
    expect(areAttemptsExhausted(ONE_TIME_CODE_DEFAULTS.maxAttempts - 1)).toBe(false);
    expect(areAttemptsExhausted(ONE_TIME_CODE_DEFAULTS.maxAttempts)).toBe(true);
    expect(canResend(new Date('2026-10-06T11:59:30Z'), now)).toBe(false);
    expect(canResend(new Date('2026-10-06T11:58:59Z'), now)).toBe(true);
  });
});

describe('csrf token', () => {
  it('is bound to the session id and secret', () => {
    const token = createCsrfToken('session-1', 'secret');
    expect(verifyCsrfToken('session-1', token, 'secret')).toBe(true);
    expect(verifyCsrfToken('session-2', token, 'secret')).toBe(false);
    expect(verifyCsrfToken('session-1', token, 'other')).toBe(false);
    expect(verifyCsrfToken('session-1', undefined, 'secret')).toBe(false);
    expect(verifyCsrfToken('session-1', '', 'secret')).toBe(false);
  });
});
