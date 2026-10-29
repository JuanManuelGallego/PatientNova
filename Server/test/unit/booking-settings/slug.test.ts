import { describe, it, expect } from 'vitest';
import { isReservedSlug, isValidSlugFormat, normalizeSlug, suggestSlug } from '../../../src/booking-settings/slug.js';

describe('normalizeSlug', () => {
  it('lowercases, strips accents and collapses separators', () => {
    expect(normalizeSlug('  Dra. María José Peña  ')).toBe('dra-maria-jose-pena');
  });

  it('trims leading/trailing hyphens and truncates to 40 chars without a trailing hyphen', () => {
    expect(normalizeSlug('--hola--')).toBe('hola');
    const long = normalizeSlug(`${'a'.repeat(39)} bcd`);
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith('-')).toBe(false);
  });
});

describe('isValidSlugFormat', () => {
  it.each([ 'abc', 'dra-maria', 'consulta-2', 'a1b2c3' ])('accepts %s', (s) => {
    expect(isValidSlugFormat(s)).toBe(true);
  });

  it.each([ 'ab', 'a'.repeat(41), '-abc', 'abc-', 'a--b', 'Abc', 'a_b', 'mar a', 'peña' ])('rejects %s', (s) => {
    expect(isValidSlugFormat(s)).toBe(false);
  });
});

describe('isReservedSlug', () => {
  it('blocks route-like words', () => {
    expect(isReservedSlug('login')).toBe(true);
    expect(isReservedSlug('book')).toBe(true);
    expect(isReservedSlug('dra-maria')).toBe(false);
  });
});

describe('suggestSlug', () => {
  it('returns the normalized base when free', async () => {
    expect(await suggestSlug('María Peña', async () => false)).toBe('maria-pena');
  });

  it('appends -2, -3 on collision', async () => {
    const taken = new Set([ 'maria-pena', 'maria-pena-2' ]);
    expect(await suggestSlug('María Peña', async (s) => taken.has(s))).toBe('maria-pena-3');
  });

  it('keeps suffixed candidates within the max length', async () => {
    const base = 'a'.repeat(40);
    const result = await suggestSlug(base, async (s) => s === base);
    expect(result).toBe(`${'a'.repeat(38)}-2`);
  });

  it('pads short or reserved bases instead of returning an invalid slug', async () => {
    expect(await suggestSlug('Al', async () => false)).toBe('consulta-al');
    expect(await suggestSlug('Login', async () => false)).toBe('login-2');
  });

  it('returns null when every attempt is taken', async () => {
    expect(await suggestSlug('maria', async () => true, 3)).toBeNull();
  });
});
