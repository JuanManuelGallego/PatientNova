import { describe, expect, it } from 'vitest';
import { resolveNodeEnv } from '../../../src/utils/config/node-env.js';

describe('resolveNodeEnv (fail closed)', () => {
  it('treats unset or blank NODE_ENV as production', () => {
    expect(resolveNodeEnv(undefined)).toBe('production');
    expect(resolveNodeEnv('')).toBe('production');
    expect(resolveNodeEnv('   ')).toBe('production');
  });

  it('keeps explicit values', () => {
    expect(resolveNodeEnv('development')).toBe('development');
    expect(resolveNodeEnv('test')).toBe('test');
    expect(resolveNodeEnv(' production ')).toBe('production');
  });
});
