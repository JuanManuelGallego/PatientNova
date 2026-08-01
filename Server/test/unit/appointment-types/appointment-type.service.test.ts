import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appointmentTypeService } from '../../../src/appointment-types/appointment-type.service.js';

vi.mock('../../../src/appointment-types/appointment-type.repository.js', () => ({
  appointmentTypeRepository: {
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

import { appointmentTypeRepository } from '../../../src/appointment-types/appointment-type.repository.js';
import { logAudit } from '../../../src/audit-log/audit-log.utils.js';

const mockRepo = vi.mocked(appointmentTypeRepository);
const mockLogAudit = vi.mocked(logAudit);

const fakeType = {
  id: 'type-1',
  name: 'Consultation',
  defaultDuration: 30,
  defaultPrice: 100,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  isDeleted: false,
  deletedAt: null,
  description: null,
  color: null,
  isActive: true,
};

beforeEach(() => vi.clearAllMocks());

describe('appointmentTypeService.findById', () => {
  it('delegates to repository.findById', async () => {
    mockRepo.findById.mockResolvedValue(fakeType as any);
    const result = await appointmentTypeService.findById('type-1', 'user-1');
    expect(mockRepo.findById).toHaveBeenCalledWith('type-1', 'user-1');
    expect(result).toEqual(fakeType);
  });

  it('propagates repository errors', async () => {
    mockRepo.findById.mockRejectedValue(new Error('Not found'));
    await expect(appointmentTypeService.findById('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('appointmentTypeService.findMany', () => {
  it('delegates to repository.findMany', async () => {
    mockRepo.findMany.mockResolvedValue([fakeType] as any);
    const result = await appointmentTypeService.findMany('user-1', { includeDeleted: false });
    expect(mockRepo.findMany).toHaveBeenCalledWith('user-1', { includeDeleted: false });
    expect(result).toEqual([fakeType]);
  });
});

describe('appointmentTypeService.create', () => {
  it('delegates to repository.create with dto and userId', async () => {
    const dto = { name: 'Follow-up', defaultDuration: 15 };
    mockRepo.create.mockResolvedValue(fakeType as any);
    const result = await appointmentTypeService.create(dto, 'user-1');
    expect(mockRepo.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual(fakeType);
  });

  it('calls logAudit after creation', async () => {
    mockRepo.create.mockResolvedValue(fakeType as any);
    await appointmentTypeService.create({ name: 'Consultation', defaultDuration: 30 }, 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'APPOINTMENT_TYPE',
      entityId: 'type-1',
      actionType: 'CREATE',
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.create.mockRejectedValue(new Error('Name already exists'));
    await expect(appointmentTypeService.create({ name: 'Dup', defaultDuration: 15 }, 'user-1')).rejects.toThrow('Name already exists');
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});

describe('appointmentTypeService.update', () => {
  it('delegates to repository.update with id, dto, and userId', async () => {
    const dto = { name: 'Updated Type' };
    mockRepo.findById.mockResolvedValue(fakeType as any);
    mockRepo.update.mockResolvedValue({ ...fakeType, ...dto } as any);
    const result = await appointmentTypeService.update('type-1', dto, 'user-1');
    expect(mockRepo.update).toHaveBeenCalledWith('type-1', dto, 'user-1');
    expect(result.name).toBe('Updated Type');
  });

  it('calls logAudit after update', async () => {
    mockRepo.findById.mockResolvedValue(fakeType as any);
    mockRepo.update.mockResolvedValue(fakeType as any);
    await appointmentTypeService.update('type-1', { name: 'New' }, 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'APPOINTMENT_TYPE',
      entityId: 'type-1',
      actionType: 'UPDATE',
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.update.mockRejectedValue(new Error('Not found'));
    await expect(appointmentTypeService.update('bad', { name: 'X' }, 'user-1')).rejects.toThrow('Not found');
  });
});

describe('appointmentTypeService.delete', () => {
  it('delegates to repository.delete and returns { id }', async () => {
    mockRepo.delete.mockResolvedValue(fakeType as any);
    const result = await appointmentTypeService.delete('type-1', 'user-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('type-1', 'user-1');
    expect(result).toEqual({ id: 'type-1' });
  });

  it('calls logAudit after deletion', async () => {
    mockRepo.delete.mockResolvedValue(fakeType as any);
    await appointmentTypeService.delete('type-1', 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'APPOINTMENT_TYPE',
      entityId: 'type-1',
      actionType: 'DELETE',
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: false },
      fieldsAfter: { isDeleted: true },
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.delete.mockRejectedValue(new Error('Not found'));
    await expect(appointmentTypeService.delete('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('appointmentTypeService.restore', () => {
  it('delegates to repository.restore', async () => {
    mockRepo.restore.mockResolvedValue(fakeType as any);
    const result = await appointmentTypeService.restore('type-1', 'user-1');
    expect(mockRepo.restore).toHaveBeenCalledWith('type-1', 'user-1');
    expect(result).toEqual(fakeType);
  });

  it('calls logAudit after restore', async () => {
    mockRepo.restore.mockResolvedValue(fakeType as any);
    await appointmentTypeService.restore('type-1', 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'APPOINTMENT_TYPE',
      entityId: 'type-1',
      actionType: 'RESTORE',
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: true },
      fieldsAfter: { isDeleted: false },
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.restore.mockRejectedValue(new Error('Not found'));
    await expect(appointmentTypeService.restore('bad', 'user-1')).rejects.toThrow('Not found');
  });
});
