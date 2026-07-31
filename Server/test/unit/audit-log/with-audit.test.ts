import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/audit-log/audit-log.service.js', () => ({
  auditLogService: { create: vi.fn().mockResolvedValue({ id: 'log-1' }) },
}));

import { withAudit } from '../../../src/audit-log/with-audit.js';
import { auditLogService } from '../../../src/audit-log/audit-log.service.js';

const mockCreate = vi.mocked(auditLogService.create);

beforeEach(() => vi.clearAllMocks());

describe('withAudit — CREATE action', () => {
  it('calls the wrapped function and creates an audit log', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'p-1', name: 'Maria' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'CREATE',
      description: 'Created patient',
      source: 'API',
    });

    const result = await wrapped('arg1', 'arg2');

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    expect(result).toEqual({ id: 'p-1', name: 'Maria' });
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const auditDto = mockCreate.mock.calls[0]![0];
    expect(auditDto.entityType).toBe('PATIENT');
    expect(auditDto.entityId).toBe('p-1');
    expect(auditDto.actionType).toBe('CREATE');
    expect(auditDto.description).toBe('Created patient');
    expect(auditDto.source).toBe('API');
  });

  it('supports description as a function', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'p-1', name: 'Maria' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'CREATE',
      description: (entity, ...args) => `Created ${entity.name} for ${args[0]}`,
    });

    await wrapped('user-1');

    const auditDto = mockCreate.mock.calls[0]![0];
    expect(auditDto.description).toBe('Created Maria for user-1');
  });

  it('captures fieldsAfter from result using string array', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'p-1', name: 'Maria', email: 'm@test.com' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'CREATE',
      description: 'test',
      fieldsAfter: ['name', 'email'],
    });

    await wrapped();

    const auditDto = mockCreate.mock.calls[0]![0];
    expect(auditDto.fieldsAfter).toEqual({ name: 'Maria', email: 'm@test.com' });
  });

  it('captures fieldsAfter from result using function', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'p-1', name: 'Maria', email: 'm@test.com' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'CREATE',
      description: 'test',
      fieldsAfter: (entity) => ({ customName: entity.name }),
    });

    await wrapped();

    const auditDto = mockCreate.mock.calls[0]![0];
    expect(auditDto.fieldsAfter).toEqual({ customName: 'Maria' });
  });

  it('captures affectedFields using function', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'p-1' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'CREATE',
      description: 'test',
      affectedFields: () => ['name', 'email'],
    });

    await wrapped();

    const auditDto = mockCreate.mock.calls[0]![0];
    expect(auditDto.affectedFields).toEqual(['name', 'email']);
  });
});

describe('withAudit — UPDATE action', () => {
  it('fetches before state, computes diff, and creates audit log', async () => {
    const getBefore = vi.fn().mockResolvedValue({ id: 'p-1', name: 'Old Name', email: 'old@test.com' });
    const fn = vi.fn().mockResolvedValue({ id: 'p-1', name: 'New Name', email: 'old@test.com' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'UPDATE',
      description: 'Updated patient',
      getBefore,
      diffFields: ['name', 'email'],
    });

    const result = await wrapped('p-1');

    expect(getBefore).toHaveBeenCalledWith('p-1');
    expect(fn).toHaveBeenCalledWith('p-1');
    expect(result).toEqual({ id: 'p-1', name: 'New Name', email: 'old@test.com' });

    const auditDto = mockCreate.mock.calls[0]![0];
    expect(auditDto.actionType).toBe('UPDATE');
    expect(auditDto.affectedFields).toEqual(['name']);
    expect(auditDto.fieldsBefore).toEqual({ name: 'Old Name' });
    expect(auditDto.fieldsAfter).toEqual({ name: 'New Name' });
  });

  it('returns empty diff when no fields changed', async () => {
    const obj = { id: 'p-1', name: 'Same' };
    const getBefore = vi.fn().mockResolvedValue({ ...obj });
    const fn = vi.fn().mockResolvedValue({ ...obj });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'UPDATE',
      description: 'test',
      getBefore,
      diffFields: ['name'],
    });

    await wrapped('p-1');

    const auditDto = mockCreate.mock.calls[0]![0];
    expect(auditDto.affectedFields).toEqual([]);
    expect(auditDto.fieldsBefore).toBeNull();
    expect(auditDto.fieldsAfter).toBeNull();
  });

  it('passes extra args to getBefore', async () => {
    const getBefore = vi.fn().mockResolvedValue({ id: 'p-1', name: 'Old' });
    const fn = vi.fn().mockResolvedValue({ id: 'p-1', name: 'New' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'UPDATE',
      description: 'test',
      getBefore,
      diffFields: ['name'],
    });

    await wrapped('p-1', 'user-1');

    expect(getBefore).toHaveBeenCalledWith('p-1', 'user-1');
  });
});

describe('withAudit — DELETE action', () => {
  it('fetches before state, captures fieldsBefore, and creates audit log', async () => {
    const getBefore = vi.fn().mockResolvedValue({ id: 'p-1', name: 'Maria', email: 'm@test.com' });
    const fn = vi.fn().mockResolvedValue({ id: 'p-1' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'DELETE',
      description: 'Deleted patient',
      getBefore,
      fieldsBefore: ['name', 'email'],
    });

    await wrapped('p-1');

    const auditDto = mockCreate.mock.calls[0]![0];
    expect(auditDto.actionType).toBe('DELETE');
    expect(auditDto.fieldsBefore).toEqual({ name: 'Maria', email: 'm@test.com' });
  });

  it('supports fieldsBefore as a function', async () => {
    const getBefore = vi.fn().mockResolvedValue({ id: 'p-1', name: 'Maria' });
    const fn = vi.fn().mockResolvedValue({ id: 'p-1' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'DELETE',
      description: 'test',
      getBefore,
      fieldsBefore: (before) => ({ customName: before.name }),
    });

    await wrapped('p-1');

    const auditDto = mockCreate.mock.calls[0]![0];
    expect(auditDto.fieldsBefore).toEqual({ customName: 'Maria' });
  });
});

describe('withAudit — RESTORE action', () => {
  it('captures fieldsAfter from result', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'p-1', name: 'Maria', email: 'm@test.com' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'RESTORE',
      description: 'Restored patient',
      fieldsAfter: ['name', 'email'],
    });

    await wrapped('p-1');

    const auditDto = mockCreate.mock.calls[0]![0];
    expect(auditDto.actionType).toBe('RESTORE');
    expect(auditDto.fieldsAfter).toEqual({ name: 'Maria', email: 'm@test.com' });
  });

  it('does not fetch before state for RESTORE', async () => {
    const getBefore = vi.fn();
    const fn = vi.fn().mockResolvedValue({ id: 'p-1', name: 'Maria' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'RESTORE',
      description: 'test',
      getBefore,
    });

    await wrapped('p-1');

    expect(getBefore).not.toHaveBeenCalled();
  });
});

describe('withAudit — defaults', () => {
  it('defaults source to API', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'p-1' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'CREATE',
      description: 'test',
    });

    await wrapped();

    const auditDto = mockCreate.mock.calls[0]![0];
    expect(auditDto.source).toBe('API');
  });

  it('uses custom source', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'p-1' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'CREATE',
      description: 'test',
      source: 'JOB',
    });

    await wrapped();

    const auditDto = mockCreate.mock.calls[0]![0];
    expect(auditDto.source).toBe('JOB');
  });

  it('propagates errors from the wrapped function', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('DB error'));
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'CREATE',
      description: 'test',
    });

    await expect(wrapped()).rejects.toThrow('DB error');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does not call getBefore for CREATE action', async () => {
    const getBefore = vi.fn();
    const fn = vi.fn().mockResolvedValue({ id: 'p-1' });
    const wrapped = withAudit(fn, {
      entityType: 'PATIENT',
      action: 'CREATE',
      description: 'test',
      getBefore,
    });

    await wrapped();

    expect(getBefore).not.toHaveBeenCalled();
  });
});
