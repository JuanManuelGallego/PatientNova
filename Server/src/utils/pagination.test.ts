import { describe, it, expect } from 'vitest';
import { buildPaginatedResult } from './pagination.js';

describe('buildPaginatedResult', () => {
  it('returns correct page metadata', () => {
    const result = buildPaginatedResult([1, 2, 3], 10, 1, 3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(3);
    expect(result.total).toBe(10);
    expect(result.totalPages).toBe(4);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('calculates totalPages correctly for exact division', () => {
    expect(buildPaginatedResult([], 9, 1, 3).totalPages).toBe(3);
  });

  it('rounds up totalPages for partial last page', () => {
    expect(buildPaginatedResult([], 10, 2, 4).totalPages).toBe(3);
  });

  it('returns 0 totalPages when total is 0', () => {
    const result = buildPaginatedResult([], 0, 1, 10);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.data).toEqual([]);
  });

  it('reflects page number and pageSize in result', () => {
    const result = buildPaginatedResult([4, 5], 20, 3, 5);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(5);
  });
});
