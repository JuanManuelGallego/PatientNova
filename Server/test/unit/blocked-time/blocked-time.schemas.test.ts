import { describe, it, expect } from 'vitest';
import { createBlockedTimeSchema, updateBlockedTimeSchema, listBlockedTimeSchema } from '../../../src/blocked-time/blocked-time.schemas.js';

const validCreate = {
  description: 'Lunch break',
  startTimeUtc: '2026-07-27T12:00:00.000Z',
  endTimeUtc: '2026-07-27T13:00:00.000Z',
};

describe('createBlockedTimeSchema', () => {
  it('accepts valid input', () => {
    const result = createBlockedTimeSchema.safeParse(validCreate);
    expect(result.success).toBe(true);
  });

  it('rejects missing description', () => {
    const result = createBlockedTimeSchema.safeParse({
      startTimeUtc: validCreate.startTimeUtc,
      endTimeUtc: validCreate.endTimeUtc,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty description', () => {
    const result = createBlockedTimeSchema.safeParse({ ...validCreate, description: '' });
    expect(result.success).toBe(false);
  });

  it('rejects description exceeding 255 chars', () => {
    const result = createBlockedTimeSchema.safeParse({ ...validCreate, description: 'a'.repeat(256) });
    expect(result.success).toBe(false);
  });

  it('accepts description with exactly 255 chars', () => {
    const result = createBlockedTimeSchema.safeParse({ ...validCreate, description: 'a'.repeat(255) });
    expect(result.success).toBe(true);
  });

  it('rejects missing startTimeUtc', () => {
    const result = createBlockedTimeSchema.safeParse({
      description: 'Break',
      endTimeUtc: validCreate.endTimeUtc,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing endTimeUtc', () => {
    const result = createBlockedTimeSchema.safeParse({
      description: 'Break',
      startTimeUtc: validCreate.startTimeUtc,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid datetime format for startTimeUtc', () => {
    const result = createBlockedTimeSchema.safeParse({ ...validCreate, startTimeUtc: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid datetime format for endTimeUtc', () => {
    const result = createBlockedTimeSchema.safeParse({ ...validCreate, endTimeUtc: '2026-07-27' });
    expect(result.success).toBe(false);
  });

  it('rejects empty input', () => {
    const result = createBlockedTimeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('updateBlockedTimeSchema', () => {
  it('accepts valid single field update', () => {
    const result = updateBlockedTimeSchema.safeParse({ description: 'Updated break' });
    expect(result.success).toBe(true);
  });

  it('accepts all fields provided', () => {
    const result = updateBlockedTimeSchema.safeParse(validCreate);
    expect(result.success).toBe(true);
  });

  it('rejects empty object', () => {
    const result = updateBlockedTimeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects description shorter than 1 char', () => {
    const result = updateBlockedTimeSchema.safeParse({ description: '' });
    expect(result.success).toBe(false);
  });

  it('rejects description exceeding 255 chars', () => {
    const result = updateBlockedTimeSchema.safeParse({ description: 'a'.repeat(256) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid datetime for startTimeUtc', () => {
    const result = updateBlockedTimeSchema.safeParse({ startTimeUtc: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid datetime for endTimeUtc', () => {
    const result = updateBlockedTimeSchema.safeParse({ endTimeUtc: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('listBlockedTimeSchema', () => {
  it('accepts empty query (all defaults)', () => {
    const result = listBlockedTimeSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
      expect(result.data.orderBy).toBe('createdAt');
      expect(result.data.order).toBe('desc');
      expect(result.data.includeDeleted).toBe(false);
    }
  });

  it('accepts valid pagination params', () => {
    const result = listBlockedTimeSchema.safeParse({ page: '2', pageSize: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(50);
    }
  });

  it('accepts valid orderBy values', () => {
    for (const field of ['startTimeUtc', 'endTimeUtc', 'createdAt', 'updatedAt']) {
      const result = listBlockedTimeSchema.safeParse({ orderBy: field });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid orderBy value', () => {
    const result = listBlockedTimeSchema.safeParse({ orderBy: 'description' });
    expect(result.success).toBe(false);
  });

  it('accepts includeDeleted=true', () => {
    const result = listBlockedTimeSchema.safeParse({ includeDeleted: 'true' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeDeleted).toBe(true);
    }
  });

  it('defaults includeDeleted to false', () => {
    const result = listBlockedTimeSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeDeleted).toBe(false);
    }
  });

  it('accepts date range filters', () => {
    const result = listBlockedTimeSchema.safeParse({
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-31T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date for from', () => {
    const result = listBlockedTimeSchema.safeParse({ from: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('rejects pageSize exceeding 100', () => {
    const result = listBlockedTimeSchema.safeParse({ pageSize: '101' });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive page', () => {
    const result = listBlockedTimeSchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });
});
