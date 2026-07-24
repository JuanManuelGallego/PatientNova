// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { locationService } from '../../../src/locations/location.service.js';

vi.mock('../../../src/locations/location.repository.js', () => ({
  locationRepository: {
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

import { locationRepository } from '../../../src/locations/location.repository.js';
import { logger } from '../../../src/utils/api/logger.js';

const mockRepo = vi.mocked(locationRepository);
const mockLogger = vi.mocked(logger);

const fakeLocation = {
  id: 'loc-1',
  name: 'Main Office',
  address: '123 Medical Blvd',
  isVirtual: false,
  userId: 'user-1',
};

beforeEach(() => vi.clearAllMocks());

describe('locationService.findById', () => {
  it('delegates to repository.findById', async () => {
    mockRepo.findById.mockResolvedValue(fakeLocation as any);
    const result = await locationService.findById('loc-1');
    expect(mockRepo.findById).toHaveBeenCalledWith('loc-1');
    expect(result).toEqual(fakeLocation);
  });

  it('propagates repository errors', async () => {
    mockRepo.findById.mockRejectedValue(new Error('Not found'));
    await expect(locationService.findById('bad')).rejects.toThrow('Not found');
  });
});

describe('locationService.findMany', () => {
  it('delegates to repository.findMany', async () => {
    mockRepo.findMany.mockResolvedValue([fakeLocation] as any);
    const result = await locationService.findMany({ includeDeleted: false });
    expect(mockRepo.findMany).toHaveBeenCalledWith({ includeDeleted: false });
    expect(result).toEqual([fakeLocation]);
  });
});

describe('locationService.create', () => {
  it('delegates to repository.create with dto and userId', async () => {
    const dto = { name: 'Virtual Room', isVirtual: true };
    mockRepo.create.mockResolvedValue(fakeLocation as any);
    const result = await locationService.create(dto, 'user-1');
    expect(mockRepo.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual(fakeLocation);
  });

  it('logs location creation', async () => {
    mockRepo.create.mockResolvedValue(fakeLocation as any);
    await locationService.create({ name: 'Main Office', isVirtual: false }, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { locationId: 'loc-1', userId: 'user-1', name: 'Main Office' },
      'Location created',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.create.mockRejectedValue(new Error('Name already exists'));
    await expect(locationService.create({ name: 'Dup' }, 'user-1')).rejects.toThrow('Name already exists');
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});

describe('locationService.update', () => {
  it('delegates to repository.update with id, dto, and userId', async () => {
    const dto = { name: 'Updated Location' };
    mockRepo.update.mockResolvedValue({ ...fakeLocation, ...dto } as any);
    const result = await locationService.update('loc-1', dto, 'user-1');
    expect(mockRepo.update).toHaveBeenCalledWith('loc-1', dto, 'user-1');
    expect(result.name).toBe('Updated Location');
  });

  it('logs location update with changed fields', async () => {
    mockRepo.update.mockResolvedValue(fakeLocation as any);
    await locationService.update('loc-1', { name: 'New' }, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { locationId: 'loc-1', userId: 'user-1', fields: ['name'] },
      'Location updated',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.update.mockRejectedValue(new Error('Not found'));
    await expect(locationService.update('bad', { name: 'X' }, 'user-1')).rejects.toThrow('Not found');
  });
});

describe('locationService.delete', () => {
  it('delegates to repository.delete with id and userId', async () => {
    mockRepo.delete.mockResolvedValue(fakeLocation as any);
    const result = await locationService.delete('loc-1', 'user-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('loc-1', 'user-1');
    expect(result).toEqual(fakeLocation);
  });

  it('logs location deletion', async () => {
    mockRepo.delete.mockResolvedValue(fakeLocation as any);
    await locationService.delete('loc-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { locationId: 'loc-1', userId: 'user-1' },
      'Location deleted',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.delete.mockRejectedValue(new Error('Not found'));
    await expect(locationService.delete('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('locationService.restore', () => {
  it('delegates to repository.restore with id and userId', async () => {
    mockRepo.restore.mockResolvedValue(fakeLocation as any);
    const result = await locationService.restore('loc-1', 'user-1');
    expect(mockRepo.restore).toHaveBeenCalledWith('loc-1', 'user-1');
    expect(result).toEqual(fakeLocation);
  });

  it('logs location restoration', async () => {
    mockRepo.restore.mockResolvedValue(fakeLocation as any);
    await locationService.restore('loc-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { locationId: 'loc-1', userId: 'user-1' },
      'Location restored',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.restore.mockRejectedValue(new Error('Not found'));
    await expect(locationService.restore('bad', 'user-1')).rejects.toThrow('Not found');
  });
});
