// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { patientService } from './patient.service.js';

vi.mock('./patient.repository.js', () => ({
  patientRepository: {
    findById: vi.fn(),
    findByIdWithRelations: vi.fn(),
    findMany: vi.fn(),
    getStats: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { patientRepository } from './patient.repository.js';
import { logger } from '../utils/logger.js';

const mockRepo = vi.mocked(patientRepository);
const mockLogger = vi.mocked(logger);

const fakePatient = {
  id: 'patient-1',
  name: 'John',
  lastName: 'Doe',
  email: 'john@test.com',
  userId: 'user-1',
};

const fakePatientWithRelations = {
  ...fakePatient,
  appointments: [{ id: 'appt-1' }],
  reminders: [{ id: 'rem-1' }],
};

beforeEach(() => vi.clearAllMocks());

describe('patientService.findById', () => {
  it('delegates to repository.findById', async () => {
    mockRepo.findById.mockResolvedValue(fakePatient as any);
    const result = await patientService.findById('patient-1');
    expect(mockRepo.findById).toHaveBeenCalledWith('patient-1');
    expect(result).toEqual(fakePatient);
  });

  it('propagates repository errors', async () => {
    mockRepo.findById.mockRejectedValue(new Error('Not found'));
    await expect(patientService.findById('bad')).rejects.toThrow('Not found');
  });
});

describe('patientService.findByIdWithRelations', () => {
  it('delegates to repository.findByIdWithRelations with userId', async () => {
    mockRepo.findByIdWithRelations.mockResolvedValue(fakePatientWithRelations as any);
    const result = await patientService.findByIdWithRelations('patient-1', 'user-1');
    expect(mockRepo.findByIdWithRelations).toHaveBeenCalledWith('patient-1', 'user-1');
    expect(result).toEqual(fakePatientWithRelations);
  });

  it('propagates repository errors', async () => {
    mockRepo.findByIdWithRelations.mockRejectedValue(new Error('Not found'));
    await expect(patientService.findByIdWithRelations('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('patientService.findMany', () => {
  it('delegates to repository.findMany with query and userId', async () => {
    const query = { page: 1, pageSize: 10, search: '', orderBy: 'createdAt', order: 'desc' as const };
    mockRepo.findMany.mockResolvedValue({ items: [fakePatient], total: 1 } as any);
    const result = await patientService.findMany(query, 'user-1');
    expect(mockRepo.findMany).toHaveBeenCalledWith(query, 'user-1');
    expect(result.items).toHaveLength(1);
  });

  it('returns empty results when no patients match', async () => {
    mockRepo.findMany.mockResolvedValue({ items: [], total: 0 } as any);
    const result = await patientService.findMany({ page: 1, pageSize: 10, search: 'xyz', orderBy: 'createdAt', order: 'desc' as const }, 'user-1');
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe('patientService.getStats', () => {
  it('delegates to repository.getStats with userId and optional query', async () => {
    mockRepo.getStats.mockResolvedValue({ total: 5, thisMonth: 2 } as any);
    const result = await patientService.getStats('user-1');
    expect(mockRepo.getStats).toHaveBeenCalledWith('user-1', undefined);
    expect(result.total).toBe(5);
  });

  it('passes query to repository when provided', async () => {
    const query = { dateFrom: '2024-01-01', dateTo: '2024-12-31' };
    mockRepo.getStats.mockResolvedValue({ total: 3 } as any);
    await patientService.getStats('user-1', query);
    expect(mockRepo.getStats).toHaveBeenCalledWith('user-1', query);
  });

  it('propagates repository errors', async () => {
    mockRepo.getStats.mockRejectedValue(new Error('DB error'));
    await expect(patientService.getStats('user-1')).rejects.toThrow('DB error');
  });
});

describe('patientService.create', () => {
  it('delegates to repository.create with dto and userId', async () => {
    const dto = { name: 'John', lastName: 'Doe', email: 'john@test.com' };
    mockRepo.create.mockResolvedValue(fakePatient as any);
    const result = await patientService.create(dto, 'user-1');
    expect(mockRepo.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual(fakePatient);
  });

  it('logs patient creation', async () => {
    mockRepo.create.mockResolvedValue(fakePatient as any);
    await patientService.create({ name: 'John', email: 'j@t.com' }, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { patientId: 'patient-1', userId: 'user-1' },
      'Patient created',
    );
  });

  it('propagates repository errors without logging', async () => {
    mockRepo.create.mockRejectedValue(new Error('Email conflict'));
    await expect(patientService.create({ name: 'X', email: 'dup' }, 'user-1')).rejects.toThrow('Email conflict');
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});

describe('patientService.update', () => {
  it('delegates to repository.update with id, dto, and userId', async () => {
    const dto = { name: 'Updated' };
    mockRepo.update.mockResolvedValue({ ...fakePatient, ...dto } as any);
    const result = await patientService.update('patient-1', dto, 'user-1');
    expect(mockRepo.update).toHaveBeenCalledWith('patient-1', dto, 'user-1');
    expect(result.name).toBe('Updated');
  });

  it('logs patient update with changed fields', async () => {
    mockRepo.update.mockResolvedValue(fakePatient as any);
    await patientService.update('patient-1', { name: 'New', email: 'new@test.com' }, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { patientId: 'patient-1', userId: 'user-1', fields: ['name', 'email'] },
      'Patient updated',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.update.mockRejectedValue(new Error('Not found'));
    await expect(patientService.update('bad', { name: 'X' }, 'user-1')).rejects.toThrow('Not found');
  });
});

describe('patientService.delete', () => {
  it('delegates to repository.delete with id and userId', async () => {
    mockRepo.delete.mockResolvedValue(fakePatient as any);
    const result = await patientService.delete('patient-1', 'user-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('patient-1', 'user-1');
    expect(result).toEqual(fakePatient);
  });

  it('logs patient deletion', async () => {
    mockRepo.delete.mockResolvedValue(fakePatient as any);
    await patientService.delete('patient-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { patientId: 'patient-1', userId: 'user-1' },
      'Patient deleted',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.delete.mockRejectedValue(new Error('Not found'));
    await expect(patientService.delete('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('patientService.restore', () => {
  it('delegates to repository.restore with id and userId', async () => {
    mockRepo.restore.mockResolvedValue(fakePatient as any);
    const result = await patientService.restore('patient-1', 'user-1');
    expect(mockRepo.restore).toHaveBeenCalledWith('patient-1', 'user-1');
    expect(result).toEqual(fakePatient);
  });

  it('logs patient restoration', async () => {
    mockRepo.restore.mockResolvedValue(fakePatient as any);
    await patientService.restore('patient-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { patientId: 'patient-1', userId: 'user-1' },
      'Patient restored',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.restore.mockRejectedValue(new Error('Not found'));
    await expect(patientService.restore('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('patientService.verifyOwnership', () => {
  it('calls repository.findById to verify ownership', async () => {
    mockRepo.findById.mockResolvedValue(fakePatient as any);
    await patientService.verifyOwnership('patient-1', 'user-1');
    expect(mockRepo.findById).toHaveBeenCalledWith('patient-1', 'user-1');
  });

  it('throws when patient not found', async () => {
    mockRepo.findById.mockRejectedValue(new Error('Not found'));
    await expect(patientService.verifyOwnership('bad-id', 'user-1')).rejects.toThrow('Not found');
  });
});
