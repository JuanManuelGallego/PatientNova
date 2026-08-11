import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/audit-log/audit-log.service.js', () => ({
  auditLogService: { create: vi.fn().mockResolvedValue({ id: 'log-1' }) },
}));

import { computeDiff, buildAuditEntry } from '../../../src/audit-log/audit-log.utils.js';
import { runInAuditContext } from '../../../src/audit-log/audit-log-context.js';

beforeEach(() => vi.clearAllMocks());

describe('computeDiff', () => {
  it('returns empty when no fields changed', () => {
    const result = computeDiff(
      { name: 'John', email: 'j@test.com' },
      { name: 'John', email: 'j@test.com' },
      ['name', 'email'],
    );
    expect(result.affectedFields).toEqual([]);
    expect(result.fieldsBefore).toBeNull();
    expect(result.fieldsAfter).toBeNull();
  });

  it('detects changed fields', () => {
    const result = computeDiff(
      { name: 'John', email: 'old@test.com' },
      { name: 'John', email: 'new@test.com' },
      ['name', 'email'],
    );
    expect(result.affectedFields).toEqual(['email']);
    expect(result.fieldsBefore).toEqual({ email: 'old@test.com' });
    expect(result.fieldsAfter).toEqual({ email: 'new@test.com' });
  });

  it('detects all fields changed', () => {
    const result = computeDiff(
      { name: 'John', age: 30 },
      { name: 'Jane', age: 25 },
      ['name', 'age'],
    );
    expect(result.affectedFields).toEqual(['name', 'age']);
    expect(result.fieldsBefore).toEqual({ name: 'John', age: 30 });
    expect(result.fieldsAfter).toEqual({ name: 'Jane', age: 25 });
  });

  it('handles empty fields list', () => {
    const result = computeDiff(
      { name: 'John' },
      { name: 'Jane' },
      [],
    );
    expect(result.affectedFields).toEqual([]);
    expect(result.fieldsBefore).toBeNull();
    expect(result.fieldsAfter).toBeNull();
  });

  it('handles fields missing from before object', () => {
    const result = computeDiff(
      { name: 'John' },
      { name: 'John', email: 'new@test.com' },
      ['name', 'email'],
    );
    expect(result.affectedFields).toEqual(['email']);
    expect(result.fieldsBefore).toEqual({ email: undefined });
    expect(result.fieldsAfter).toEqual({ email: 'new@test.com' });
  });

  it('handles fields missing from after object', () => {
    const result = computeDiff(
      { name: 'John', email: 'old@test.com' },
      { name: 'John' },
      ['name', 'email'],
    );
    expect(result.affectedFields).toEqual(['email']);
    expect(result.fieldsBefore).toEqual({ email: 'old@test.com' });
    expect(result.fieldsAfter).toEqual({ email: undefined });
  });

  it('detects nested object changes via JSON.stringify', () => {
    const result = computeDiff(
      { meta: { a: 1, b: 2 } },
      { meta: { a: 1, b: 3 } },
      ['meta'],
    );
    expect(result.affectedFields).toEqual(['meta']);
    expect(result.fieldsBefore).toEqual({ meta: { a: 1, b: 2 } });
    expect(result.fieldsAfter).toEqual({ meta: { a: 1, b: 3 } });
  });

  it('handles null vs undefined and zero vs empty string', () => {
    expect(computeDiff({ val: null }, { val: undefined }, ['val']).affectedFields).toEqual(['val']);
    expect(computeDiff({ count: 0 }, { count: '' }, ['count']).affectedFields).toEqual(['count']);
  });

  it('handles Date serialization', () => {
    const d1 = new Date('2024-01-01T00:00:00.000Z');
    const d2 = new Date('2024-06-15T12:00:00.000Z');
    expect(computeDiff({ date: d1 }, { date: d2 }, ['date']).affectedFields).toEqual(['date']);
  });

  it('does not flag identical Dates', () => {
    const d = new Date('2024-01-01T00:00:00.000Z');
    expect(computeDiff({ date: d }, { date: new Date('2024-01-01T00:00:00.000Z') }, ['date']).affectedFields).toEqual([]);
  });
});

describe('buildAuditEntry', () => {
  it('uses defaults when no audit context is set', () => {
    const entry = buildAuditEntry({
      entityType: 'PATIENT',
      entityId: 'p-1',
      actionType: 'CREATE',
      description: 'Created patient',
    });
    expect(entry.actorId).toBe('system');
    expect(entry.actorDisplayName).toBe('Sistema');
    expect(entry.entityType).toBe('PATIENT');
    expect(entry.entityId).toBe('p-1');
    expect(entry.actionType).toBe('CREATE');
    expect(entry.source).toBe('API');
    expect(entry.description).toBe('Created patient');
    expect(entry.affectedFields).toEqual([]);
  });

  it('uses audit context when available', () => {
    runInAuditContext(
      { actorId: 'user-1', actorDisplayName: 'Test User', ipAddress: '10.0.0.1', userId: 'u-1' },
      () => {
        const entry = buildAuditEntry({
          entityType: 'APPOINTMENT',
          entityId: 'a-1',
          actionType: 'UPDATE',
          description: 'Updated',
        });
        expect(entry.actorId).toBe('user-1');
        expect(entry.actorDisplayName).toBe('Test User');
        expect(entry.ipAddress).toBe('10.0.0.1');
        expect(entry.userId).toBe('u-1');
      },
    );
  });

  it('applies explicit overrides over context', () => {
    runInAuditContext(
      { actorId: 'user-1', actorDisplayName: 'Test User', ipAddress: '10.0.0.1' },
      () => {
        const entry = buildAuditEntry({
          entityType: 'REMINDER',
          entityId: 'r-1',
          actionType: 'DELETE',
          source: 'JOB',
          description: 'Deleted reminder',
          affectedFields: ['status'],
          fieldsBefore: { status: 'PENDING' },
          reason: 'Cleanup',
          ipAddress: '192.168.1.1',
          userId: 'explicit-user',
        });
        expect(entry.entityType).toBe('REMINDER');
        expect(entry.actionType).toBe('DELETE');
        expect(entry.source).toBe('JOB');
        expect(entry.affectedFields).toEqual(['status']);
        expect(entry.fieldsBefore).toEqual({ status: 'PENDING' });
        expect(entry.reason).toBe('Cleanup');
        expect(entry.ipAddress).toBe('192.168.1.1');
        expect(entry.userId).toBe('explicit-user');
      },
    );
  });
});
