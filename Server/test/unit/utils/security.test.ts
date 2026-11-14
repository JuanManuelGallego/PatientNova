import { describe, expect, it } from 'vitest';
import { safeEqual } from '../../../src/utils/security/safe-equal.js';
import { createCsrfToken, verifyCsrfToken } from '../../../src/utils/security/csrf.js';

describe('safeEqual', () => {
  it('compares equal and different strings, including different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
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
