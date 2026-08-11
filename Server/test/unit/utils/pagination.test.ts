import { describe, it, expect } from 'vitest';
import { buildPaginatedResult } from '../../../src/utils/api/pagination.js';

describe('buildPaginatedResult', () => {
  it('returns correct page metadata with totalPages', () => {
    const result = buildPaginatedResult([1, 2, 3], 10, 1, 3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(3);
    expect(result.total).toBe(10);
    expect(result.totalPages).toBe(4);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('returns 0 totalPages when total is 0', () => {
    const result = buildPaginatedResult([], 0, 1, 10);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.data).toEqual([]);
  });
});
