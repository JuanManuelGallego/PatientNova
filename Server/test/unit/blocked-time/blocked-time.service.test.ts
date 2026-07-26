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
  },
}));

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { blockedTimeRepository } from '../../../src/blocked-time/blocked-time.repository.js';
import { logger } from '../../../src/utils/api/logger.js';

const mockRepo = vi.mocked(blockedTimeRepository);
const mockLogger = vi.mocked(logger);

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
    mockRepo.create.mockResolvedValue(fakeBlockedTime as any);
    const result = await blockedTimeService.create(dto, 'user-1');
    expect(mockRepo.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual(fakeBlockedTime);
  });

  it('logs blocked time creation', async () => {
    mockRepo.create.mockResolvedValue(fakeBlockedTime as any);
    await blockedTimeService.create({ description: 'Lunch break', startTimeUtc: '2026-07-27T12:00:00.000Z', endTimeUtc: '2026-07-27T13:00:00.000Z' }, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { blockedTimeId: 'bt-1', userId: 'user-1' },
      'Blocked time created',
    );
  });

  it('propagates repository errors without logging', async () => {
    mockRepo.create.mockRejectedValue(new Error('Validation error'));
    await expect(blockedTimeService.create({ description: 'X', startTimeUtc: '2026-07-27T12:00:00.000Z', endTimeUtc: '2026-07-27T13:00:00.000Z' }, 'user-1')).rejects.toThrow('Validation error');
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});

describe('blockedTimeService.update', () => {
  it('delegates to repository.update with id, dto, and userId', async () => {
    const dto = { description: 'Updated break' };
    mockRepo.update.mockResolvedValue({ ...fakeBlockedTime, ...dto } as any);
    const result = await blockedTimeService.update('bt-1', dto, 'user-1');
    expect(mockRepo.update).toHaveBeenCalledWith('bt-1', dto, 'user-1');
    expect(result.description).toBe('Updated break');
  });

  it('logs blocked time update with changed fields', async () => {
    mockRepo.update.mockResolvedValue(fakeBlockedTime as any);
    await blockedTimeService.update('bt-1', { description: 'New', startTimeUtc: '2026-07-27T14:00:00.000Z' }, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { blockedTimeId: 'bt-1', userId: 'user-1', fields: ['description', 'startTimeUtc'] },
      'Blocked time updated',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.update.mockRejectedValue(new Error('Not found'));
    await expect(blockedTimeService.update('bad', { description: 'X' }, 'user-1')).rejects.toThrow('Not found');
  });
});

describe('blockedTimeService.delete', () => {
  it('delegates to repository.delete with id and userId', async () => {
    mockRepo.delete.mockResolvedValue(fakeBlockedTime as any);
    const result = await blockedTimeService.delete('bt-1', 'user-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('bt-1', 'user-1');
    expect(result).toEqual(fakeBlockedTime);
  });

  it('logs blocked time deletion', async () => {
    mockRepo.delete.mockResolvedValue(fakeBlockedTime as any);
    await blockedTimeService.delete('bt-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { blockedTimeId: 'bt-1', userId: 'user-1' },
      'Blocked time deleted',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.delete.mockRejectedValue(new Error('Not found'));
    await expect(blockedTimeService.delete('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('blockedTimeService.restore', () => {
  it('delegates to repository.restore with id and userId', async () => {
    mockRepo.restore.mockResolvedValue(fakeBlockedTime as any);
    const result = await blockedTimeService.restore('bt-1', 'user-1');
    expect(mockRepo.restore).toHaveBeenCalledWith('bt-1', 'user-1');
    expect(result).toEqual(fakeBlockedTime);
  });

  it('logs blocked time restoration', async () => {
    mockRepo.restore.mockResolvedValue(fakeBlockedTime as any);
    await blockedTimeService.restore('bt-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { blockedTimeId: 'bt-1', userId: 'user-1' },
      'Blocked time restored',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.restore.mockRejectedValue(new Error('Not found'));
    await expect(blockedTimeService.restore('bad', 'user-1')).rejects.toThrow('Not found');
  });
});
