import { describe, it, expect } from 'vitest';
import { isPrismaUniqueConstraintError } from './prismaErrors.js';

describe('isPrismaUniqueConstraintError', () => {
  it('returns true for P2002 Prisma error', () => {
    const err = { code: 'P2002' };
    expect(isPrismaUniqueConstraintError(err)).toBe(true);
  });

  it('returns false for other Prisma error codes', () => {
    expect(isPrismaUniqueConstraintError({ code: 'P2000' })).toBe(false);
    expect(isPrismaUniqueConstraintError({ code: 'P2025' })).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isPrismaUniqueConstraintError(null)).toBe(false);
    expect(isPrismaUniqueConstraintError(undefined)).toBe(false);
    expect(isPrismaUniqueConstraintError('P2002')).toBe(false);
    expect(isPrismaUniqueConstraintError(42)).toBe(false);
  });

  it('returns false for objects without code', () => {
    expect(isPrismaUniqueConstraintError({})).toBe(false);
    expect(isPrismaUniqueConstraintError({ message: 'P2002' })).toBe(false);
  });
});
