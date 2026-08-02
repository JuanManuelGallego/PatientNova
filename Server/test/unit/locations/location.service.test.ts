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

vi.mock('../../../src/audit-log/audit-log.utils.js', () => ({
  logAudit: vi.fn(),
  computeDiff: vi.fn(() => ({ affectedFields: [], fieldsBefore: null, fieldsAfter: null })),
}));

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { locationRepository } from '../../../src/locations/location.repository.js';
import { logAudit } from '../../../src/audit-log/audit-log.utils.js';

const mockRepo = vi.mocked(locationRepository);
const mockLogAudit = vi.mocked(logAudit);

const fakeLocation = {
  id: 'loc-1',
  name: 'Main Office',
  address: '123 Medical Blvd',
  isVirtual: false,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  isDeleted: false,
  deletedAt: null,
  defaultPrice: null,
  color: null,
  isActive: true,
  instructions: null,
};

beforeEach(() => vi.clearAllMocks());

describe('locationService.findById', () => {
  it('delegates to repository.findById', async () => {
    mockRepo.findById.mockResolvedValue(fakeLocation as any);
    const result = await locationService.findById('loc-1', 'user-1');
    expect(mockRepo.findById).toHaveBeenCalledWith('loc-1', 'user-1');
    expect(result).toEqual(fakeLocation);
  });

  it('propagates repository errors', async () => {
    mockRepo.findById.mockRejectedValue(new Error('Not found'));
    await expect(locationService.findById('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('locationService.findMany', () => {
  it('delegates to repository.findMany', async () => {
    mockRepo.findMany.mockResolvedValue([fakeLocation] as any);
    const result = await locationService.findMany('user-1', { includeDeleted: false });
    expect(mockRepo.findMany).toHaveBeenCalledWith('user-1', { includeDeleted: false });
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

  it('calls logAudit after creation', async () => {
    mockRepo.create.mockResolvedValue(fakeLocation as any);
    await locationService.create({ name: 'Main Office', isVirtual: false, address: '123 Medical Blvd', instructions: 'Enter through main door' }, 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'APPOINTMENT_LOCATION',
      entityId: 'loc-1',
      actionType: 'CREATE',
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.create.mockRejectedValue(new Error('Name already exists'));
    await expect(locationService.create({ name: 'Dup', isVirtual: true }, 'user-1')).rejects.toThrow('Name already exists');
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});

describe('locationService.update', () => {
  it('delegates to repository.update with id, dto, and userId', async () => {
    const dto = { name: 'Updated Location' };
    mockRepo.findById.mockResolvedValue(fakeLocation as any);
    mockRepo.update.mockResolvedValue({ ...fakeLocation, ...dto } as any);
    const result = await locationService.update('loc-1', dto, 'user-1');
    expect(mockRepo.update).toHaveBeenCalledWith('loc-1', dto, 'user-1');
    expect(result.name).toBe('Updated Location');
  });

  it('calls logAudit after update', async () => {
    mockRepo.findById.mockResolvedValue(fakeLocation as any);
    mockRepo.update.mockResolvedValue(fakeLocation as any);
    await locationService.update('loc-1', { name: 'New' }, 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'APPOINTMENT_LOCATION',
      entityId: 'loc-1',
      actionType: 'UPDATE',
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.update.mockRejectedValue(new Error('Not found'));
    await expect(locationService.update('bad', { name: 'X' }, 'user-1')).rejects.toThrow('Not found');
  });
});

describe('locationService.delete', () => {
  it('delegates to repository.delete and returns { id }', async () => {
    mockRepo.delete.mockResolvedValue(fakeLocation as any);
    const result = await locationService.delete('loc-1', 'user-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('loc-1', 'user-1');
    expect(result).toEqual({ id: 'loc-1' });
  });

  it('calls logAudit after deletion', async () => {
    mockRepo.delete.mockResolvedValue(fakeLocation as any);
    await locationService.delete('loc-1', 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'APPOINTMENT_LOCATION',
      entityId: 'loc-1',
      actionType: 'DELETE',
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: false },
      fieldsAfter: { isDeleted: true },
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.delete.mockRejectedValue(new Error('Not found'));
    await expect(locationService.delete('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('locationService.restore', () => {
  it('delegates to repository.restore', async () => {
    mockRepo.restore.mockResolvedValue(fakeLocation as any);
    const result = await locationService.restore('loc-1', 'user-1');
    expect(mockRepo.restore).toHaveBeenCalledWith('loc-1', 'user-1');
    expect(result).toEqual(fakeLocation);
  });

  it('calls logAudit after restore', async () => {
    mockRepo.restore.mockResolvedValue(fakeLocation as any);
    await locationService.restore('loc-1', 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'APPOINTMENT_LOCATION',
      entityId: 'loc-1',
      actionType: 'RESTORE',
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: true },
      fieldsAfter: { isDeleted: false },
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.restore.mockRejectedValue(new Error('Not found'));
    await expect(locationService.restore('bad', 'user-1')).rejects.toThrow('Not found');
  });
});
