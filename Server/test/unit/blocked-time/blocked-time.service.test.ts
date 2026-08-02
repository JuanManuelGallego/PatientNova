import { describe, it, expect, vi, beforeEach } from 'vitest';
import { blockedTimeService } from '../../../src/blocked-time/blocked-time.service.js';

vi.mock('../../../src/blocked-time/blocked-time.repository.js', () => ({
  blockedTimeRepository: {
    findById: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    hasBlockedTimeOverlap: vi.fn(),
  },
}));

vi.mock('../../../src/audit-log/audit-log.utils.js', () => ({
  logAudit: vi.fn(),
  computeDiff: vi.fn(() => ({ affectedFields: [], fieldsBefore: null, fieldsAfter: null })),
}));

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { blockedTimeRepository } from '../../../src/blocked-time/blocked-time.repository.js';
import { logAudit } from '../../../src/audit-log/audit-log.utils.js';

const mockRepo = vi.mocked(blockedTimeRepository);
const mockLogAudit = vi.mocked(logAudit);

const fakeBlockedTime = {
  id: 'bt-1',
  userId: 'user-1',
  description: 'Lunch break',
  startTimeUtc: new Date('2026-07-27T12:00:00Z'),
  endTimeUtc: new Date('2026-07-27T13:00:00Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  isDeleted: false,
  deletedAt: null,
};

beforeEach(() => vi.clearAllMocks());

describe('blockedTimeService.findById', () => {
  it('delegates to repository.findById', async () => {
    mockRepo.findById.mockResolvedValue(fakeBlockedTime as any);
    const result = await blockedTimeService.findById('bt-1', 'user-1');
    expect(mockRepo.findById).toHaveBeenCalledWith('bt-1', 'user-1');
    expect(result).toEqual(fakeBlockedTime);
  });

  it('propagates repository errors', async () => {
    mockRepo.findById.mockRejectedValue(new Error('Not found'));
    await expect(blockedTimeService.findById('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('blockedTimeService.findMany', () => {
  it('delegates to repository.findMany with query and userId', async () => {
    const query = { page: 1, pageSize: 10, orderBy: 'createdAt' as const, order: 'desc' as const, includeDeleted: false };
    mockRepo.findMany.mockResolvedValue({ data: [fakeBlockedTime], total: 1, page: 1, pageSize: 10 } as any);
    const result = await blockedTimeService.findMany('user-1', query);
    expect(mockRepo.findMany).toHaveBeenCalledWith('user-1', query);
    expect(result.data).toHaveLength(1);
  });

  it('returns empty results when no blocked times match', async () => {
    mockRepo.findMany.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10 } as any);
    const result = await blockedTimeService.findMany('user-1', { page: 1, pageSize: 10, orderBy: 'createdAt' as const, order: 'desc' as const, includeDeleted: false });
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe('blockedTimeService.create', () => {
  it('delegates to repository.create with dto and userId', async () => {
    const dto = { description: 'Lunch break', startTimeUtc: '2026-07-27T12:00:00.000Z', endTimeUtc: '2026-07-27T13:00:00.000Z' };
    mockRepo.hasBlockedTimeOverlap.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(fakeBlockedTime as any);
    const result = await blockedTimeService.create(dto, 'user-1');
    expect(mockRepo.hasBlockedTimeOverlap).toHaveBeenCalledWith('user-1', new Date(dto.startTimeUtc), new Date(dto.endTimeUtc), undefined);
    expect(mockRepo.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual(fakeBlockedTime);
  });

  it('throws BlockedTimeOverlapError when overlap exists', async () => {
    const dto = { description: 'Lunch break', startTimeUtc: '2026-07-27T12:00:00.000Z', endTimeUtc: '2026-07-27T13:00:00.000Z' };
    mockRepo.hasBlockedTimeOverlap.mockResolvedValue({ id: 'existing', description: 'Conflict', startTimeUtc: new Date('2026-07-27T11:00:00Z'), endTimeUtc: new Date('2026-07-27T14:00:00Z') });
    await expect(blockedTimeService.create(dto, 'user-1')).rejects.toThrow('overlaps');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('calls logAudit after creation', async () => {
    mockRepo.hasBlockedTimeOverlap.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(fakeBlockedTime as any);
    await blockedTimeService.create({ description: 'Lunch break', startTimeUtc: '2026-07-27T12:00:00.000Z', endTimeUtc: '2026-07-27T13:00:00.000Z' }, 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'BLOCKED_TIME',
      entityId: 'bt-1',
      actionType: 'CREATE',
    }));
  });

  it('propagates repository errors without logging', async () => {
    mockRepo.hasBlockedTimeOverlap.mockResolvedValue(null);
    mockRepo.create.mockRejectedValue(new Error('Validation error'));
    await expect(blockedTimeService.create({ description: 'X', startTimeUtc: '2026-07-27T12:00:00.000Z', endTimeUtc: '2026-07-27T13:00:00.000Z' }, 'user-1')).rejects.toThrow('Validation error');
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});

describe('blockedTimeService.update', () => {
  it('delegates to repository.update with id, dto, and userId', async () => {
    const dto = { description: 'Updated break' };
    mockRepo.findById.mockResolvedValue(fakeBlockedTime as any);
    mockRepo.update.mockResolvedValue({ ...fakeBlockedTime, ...dto } as any);
    const result = await blockedTimeService.update('bt-1', dto, 'user-1');
    expect(mockRepo.update).toHaveBeenCalledWith('bt-1', dto, 'user-1');
    expect(result.description).toBe('Updated break');
  });

  it('skips overlap check when only description is updated', async () => {
    const dto = { description: 'Updated break' };
    mockRepo.findById.mockResolvedValue(fakeBlockedTime as any);
    mockRepo.update.mockResolvedValue({ ...fakeBlockedTime, ...dto } as any);
    await blockedTimeService.update('bt-1', dto, 'user-1');
    expect(mockRepo.hasBlockedTimeOverlap).not.toHaveBeenCalled();
  });

  it('checks overlap when startTimeUtc is updated', async () => {
    mockRepo.findById.mockResolvedValue(fakeBlockedTime as any);
    mockRepo.hasBlockedTimeOverlap.mockResolvedValue(null);
    mockRepo.update.mockResolvedValue(fakeBlockedTime as any);
    await blockedTimeService.update('bt-1', { startTimeUtc: '2026-07-27T14:00:00.000Z' }, 'user-1');
    expect(mockRepo.hasBlockedTimeOverlap).toHaveBeenCalledWith('user-1', new Date('2026-07-27T14:00:00.000Z'), fakeBlockedTime.endTimeUtc, 'bt-1');
  });

  it('checks overlap when endTimeUtc is updated', async () => {
    mockRepo.findById.mockResolvedValue(fakeBlockedTime as any);
    mockRepo.hasBlockedTimeOverlap.mockResolvedValue(null);
    mockRepo.update.mockResolvedValue(fakeBlockedTime as any);
    await blockedTimeService.update('bt-1', { endTimeUtc: '2026-07-27T15:00:00.000Z' }, 'user-1');
    expect(mockRepo.hasBlockedTimeOverlap).toHaveBeenCalledWith('user-1', fakeBlockedTime.startTimeUtc, new Date('2026-07-27T15:00:00.000Z'), 'bt-1');
  });

  it('throws BlockedTimeOverlapError when update causes overlap', async () => {
    mockRepo.findById.mockResolvedValue(fakeBlockedTime as any);
    mockRepo.hasBlockedTimeOverlap.mockResolvedValue({ id: 'other', description: 'Conflict', startTimeUtc: new Date('2026-07-27T11:00:00Z'), endTimeUtc: new Date('2026-07-27T16:00:00Z') });
    await expect(blockedTimeService.update('bt-1', { startTimeUtc: '2026-07-27T14:00:00.000Z' }, 'user-1')).rejects.toThrow('overlaps');
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('calls logAudit after update', async () => {
    mockRepo.findById.mockResolvedValue(fakeBlockedTime as any);
    mockRepo.hasBlockedTimeOverlap.mockResolvedValue(null);
    mockRepo.update.mockResolvedValue(fakeBlockedTime as any);
    await blockedTimeService.update('bt-1', { description: 'New', startTimeUtc: '2026-07-27T14:00:00.000Z' }, 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'BLOCKED_TIME',
      entityId: 'bt-1',
      actionType: 'UPDATE',
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.update.mockRejectedValue(new Error('Not found'));
    await expect(blockedTimeService.update('bad', { description: 'X' }, 'user-1')).rejects.toThrow('Not found');
  });
});

describe('blockedTimeService.delete', () => {
  it('delegates to repository.delete and returns { id }', async () => {
    mockRepo.delete.mockResolvedValue(fakeBlockedTime as any);
    const result = await blockedTimeService.delete('bt-1', 'user-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('bt-1', 'user-1');
    expect(result).toEqual({ id: 'bt-1' });
  });

  it('calls logAudit after deletion', async () => {
    mockRepo.delete.mockResolvedValue(fakeBlockedTime as any);
    await blockedTimeService.delete('bt-1', 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'BLOCKED_TIME',
      entityId: 'bt-1',
      actionType: 'DELETE',
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: false },
      fieldsAfter: { isDeleted: true },
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.delete.mockRejectedValue(new Error('Not found'));
    await expect(blockedTimeService.delete('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('blockedTimeService.restore', () => {
  it('delegates to repository.restore', async () => {
    mockRepo.restore.mockResolvedValue(fakeBlockedTime as any);
    const result = await blockedTimeService.restore('bt-1', 'user-1');
    expect(mockRepo.restore).toHaveBeenCalledWith('bt-1', 'user-1');
    expect(result).toEqual(fakeBlockedTime);
  });

  it('calls logAudit after restore', async () => {
    mockRepo.restore.mockResolvedValue(fakeBlockedTime as any);
    await blockedTimeService.restore('bt-1', 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'BLOCKED_TIME',
      entityId: 'bt-1',
      actionType: 'RESTORE',
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: true },
      fieldsAfter: { isDeleted: false },
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.restore.mockRejectedValue(new Error('Not found'));
    await expect(blockedTimeService.restore('bad', 'user-1')).rejects.toThrow('Not found');
  });
});
