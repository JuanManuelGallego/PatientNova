// @ts-nocheck
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

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { appointmentTypeRepository } from '../../../src/appointment-types/appointment-type.repository.js';
import { logger } from '../../../src/utils/api/logger.js';

const mockRepo = vi.mocked(appointmentTypeRepository);
const mockLogger = vi.mocked(logger);

const fakeType = {
  id: 'type-1',
  name: 'Consultation',
  duration: 30,
  price: 100,
  userId: 'user-1',
};

beforeEach(() => vi.clearAllMocks());

describe('appointmentTypeService.findById', () => {
  it('delegates to repository.findById', async () => {
    mockRepo.findById.mockResolvedValue(fakeType as any);
    const result = await appointmentTypeService.findById('type-1');
    expect(mockRepo.findById).toHaveBeenCalledWith('type-1');
    expect(result).toEqual(fakeType);
  });

  it('propagates repository errors', async () => {
    mockRepo.findById.mockRejectedValue(new Error('Not found'));
    await expect(appointmentTypeService.findById('bad')).rejects.toThrow('Not found');
  });
});

describe('appointmentTypeService.findMany', () => {
  it('delegates to repository.findMany', async () => {
    mockRepo.findMany.mockResolvedValue([fakeType] as any);
    const result = await appointmentTypeService.findMany({ includeDeleted: false });
    expect(mockRepo.findMany).toHaveBeenCalledWith({ includeDeleted: false });
    expect(result).toEqual([fakeType]);
  });
});

describe('appointmentTypeService.create', () => {
  it('delegates to repository.create with dto and userId', async () => {
    const dto = { name: 'Follow-up', duration: 15 };
    mockRepo.create.mockResolvedValue(fakeType as any);
    const result = await appointmentTypeService.create(dto, 'user-1');
    expect(mockRepo.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual(fakeType);
  });

  it('logs appointment type creation', async () => {
    mockRepo.create.mockResolvedValue(fakeType as any);
    await appointmentTypeService.create({ name: 'Consultation', duration: 30 }, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { appointmentTypeId: 'type-1', userId: 'user-1', name: 'Consultation' },
      'Appointment type created',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.create.mockRejectedValue(new Error('Name already exists'));
    await expect(appointmentTypeService.create({ name: 'Dup', duration: 15 }, 'user-1')).rejects.toThrow('Name already exists');
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});

describe('appointmentTypeService.update', () => {
  it('delegates to repository.update with id, dto, and userId', async () => {
    const dto = { name: 'Updated Type' };
    mockRepo.update.mockResolvedValue({ ...fakeType, ...dto } as any);
    const result = await appointmentTypeService.update('type-1', dto, 'user-1');
    expect(mockRepo.update).toHaveBeenCalledWith('type-1', dto, 'user-1');
    expect(result.name).toBe('Updated Type');
  });

  it('logs appointment type update with changed fields', async () => {
    mockRepo.update.mockResolvedValue(fakeType as any);
    await appointmentTypeService.update('type-1', { name: 'New' }, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { appointmentTypeId: 'type-1', userId: 'user-1', fields: ['name'] },
      'Appointment type updated',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.update.mockRejectedValue(new Error('Not found'));
    await expect(appointmentTypeService.update('bad', { name: 'X' }, 'user-1')).rejects.toThrow('Not found');
  });
});

describe('appointmentTypeService.delete', () => {
  it('delegates to repository.delete with id and userId', async () => {
    mockRepo.delete.mockResolvedValue(fakeType as any);
    const result = await appointmentTypeService.delete('type-1', 'user-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('type-1', 'user-1');
    expect(result).toEqual(fakeType);
  });

  it('logs appointment type deletion', async () => {
    mockRepo.delete.mockResolvedValue(fakeType as any);
    await appointmentTypeService.delete('type-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { appointmentTypeId: 'type-1', userId: 'user-1' },
      'Appointment type deleted',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.delete.mockRejectedValue(new Error('Not found'));
    await expect(appointmentTypeService.delete('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('appointmentTypeService.restore', () => {
  it('delegates to repository.restore with id and userId', async () => {
    mockRepo.restore.mockResolvedValue(fakeType as any);
    const result = await appointmentTypeService.restore('type-1', 'user-1');
    expect(mockRepo.restore).toHaveBeenCalledWith('type-1', 'user-1');
    expect(result).toEqual(fakeType);
  });

  it('logs appointment type restoration', async () => {
    mockRepo.restore.mockResolvedValue(fakeType as any);
    await appointmentTypeService.restore('type-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { appointmentTypeId: 'type-1', userId: 'user-1' },
      'Appointment type restored',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.restore.mockRejectedValue(new Error('Not found'));
    await expect(appointmentTypeService.restore('bad', 'user-1')).rejects.toThrow('Not found');
  });
});
