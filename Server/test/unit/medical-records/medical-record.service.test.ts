import { describe, it, expect, vi, beforeEach } from 'vitest';
import { medicalRecordService } from '../../../src/medical-records/medical-record.service.js';

vi.mock('../../../src/medical-records/medical-record.repository.js', () => ({
  medicalRecordRepository: {
    findById: vi.fn(),
    findByPatientId: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/audit-log/audit-log.utils.js', () => ({
  logAudit: vi.fn(),
  computeDiff: vi.fn(() => ({ affectedFields: [], fieldsBefore: null, fieldsAfter: null })),
}));

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { medicalRecordRepository } from '../../../src/medical-records/medical-record.repository.js';
import { logAudit } from '../../../src/audit-log/audit-log.utils.js';

const mockRepo = vi.mocked(medicalRecordRepository);
const mockLogAudit = vi.mocked(logAudit);

const fakeRecord = {
  id: 'rec-1',
  patientId: 'patient-1',
  name: 'John Doe',
  sex: 'M',
};

beforeEach(() => vi.clearAllMocks());

describe('medicalRecordService.findById', () => {
  it('delegates to repository.findById', async () => {
    mockRepo.findById.mockResolvedValue(fakeRecord as any);
    const result = await medicalRecordService.findById('rec-1', 'user-1');
    expect(mockRepo.findById).toHaveBeenCalledWith('rec-1', 'user-1');
    expect(result).toEqual(fakeRecord);
  });

  it('propagates repository errors', async () => {
    mockRepo.findById.mockRejectedValue(new Error('Medical record with id "bad" not found'));
    await expect(medicalRecordService.findById('bad', 'user-1')).rejects.toThrow('Medical record with id "bad" not found');
  });
});

describe('medicalRecordService.findByPatientId', () => {
  it('delegates to repository.findByPatientId', async () => {
    mockRepo.findByPatientId.mockResolvedValue(fakeRecord as any);
    const result = await medicalRecordService.findByPatientId('patient-1', 'user-1');
    expect(mockRepo.findByPatientId).toHaveBeenCalledWith('patient-1', 'user-1');
    expect(result).toEqual(fakeRecord);
  });

  it('propagates repository errors', async () => {
    mockRepo.findByPatientId.mockRejectedValue(new Error('Not found'));
    await expect(medicalRecordService.findByPatientId('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('medicalRecordService.findMany', () => {
  it('delegates to repository.findMany', async () => {
    mockRepo.findMany.mockResolvedValue({ data: [fakeRecord], total: 1, page: 1, pageSize: 10 } as any);
    const query = { page: 1, pageSize: 10, search: '', orderBy: 'createdAt' as const, order: 'desc' as const, includeDeleted: false };
    const result = await medicalRecordService.findMany(query, 'user-1');
    expect(mockRepo.findMany).toHaveBeenCalledWith(query, 'user-1');
    expect(result.data).toHaveLength(1);
  });

  it('returns empty results when no records match', async () => {
    mockRepo.findMany.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10 } as any);
    const result = await medicalRecordService.findMany({ page: 1, pageSize: 10, search: 'xyz', orderBy: 'createdAt' as const, order: 'desc' as const, includeDeleted: false }, 'user-1');
    expect(result.data).toHaveLength(0);
  });
});

describe('medicalRecordService.create', () => {
  it('delegates to repository.create with dto and userId', async () => {
    mockRepo.create.mockResolvedValue(fakeRecord as any);
    const dto = { patientId: 'patient-1', name: 'John Doe' };
    const result = await medicalRecordService.create(dto, 'user-1');
    expect(mockRepo.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual(fakeRecord);
  });

  it('calls logAudit after creation', async () => {
    mockRepo.create.mockResolvedValue(fakeRecord as any);
    await medicalRecordService.create({ patientId: 'patient-1', name: 'John Doe' }, 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'MEDICAL_RECORD',
      entityId: 'rec-1',
      actionType: 'CREATE',
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.create.mockRejectedValue(new Error('DB error'));
    await expect(medicalRecordService.create({ patientId: 'patient-1', name: 'X' }, 'user-1')).rejects.toThrow('DB error');
  });
});

describe('medicalRecordService.update', () => {
  it('delegates to repository.update with id, dto, and userId', async () => {
    const dto = { name: 'Updated Name' };
    mockRepo.findById.mockResolvedValue(fakeRecord as any);
    mockRepo.update.mockResolvedValue({ ...fakeRecord, ...dto } as any);
    const result = await medicalRecordService.update('rec-1', dto, 'user-1');
    expect(mockRepo.update).toHaveBeenCalledWith('rec-1', dto, 'user-1');
    expect(result.name).toBe('Updated Name');
  });

  it('calls logAudit after update', async () => {
    mockRepo.findById.mockResolvedValue(fakeRecord as any);
    mockRepo.update.mockResolvedValue(fakeRecord as any);
    await medicalRecordService.update('rec-1', { name: 'New' }, 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'MEDICAL_RECORD',
      entityId: 'rec-1',
      actionType: 'UPDATE',
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.update.mockRejectedValue(new Error('Not found'));
    await expect(medicalRecordService.update('bad', { name: 'X' }, 'user-1')).rejects.toThrow('Not found');
  });
});

describe('medicalRecordService.softDelete', () => {
  it('delegates to repository.softDelete and returns { id }', async () => {
    mockRepo.softDelete.mockResolvedValue(fakeRecord as any);
    const result = await medicalRecordService.softDelete('rec-1', 'user-1');
    expect(mockRepo.softDelete).toHaveBeenCalledWith('rec-1', 'user-1');
    expect(result).toEqual({ id: 'rec-1' });
  });

  it('calls logAudit after softDelete', async () => {
    mockRepo.softDelete.mockResolvedValue(fakeRecord as any);
    await medicalRecordService.softDelete('rec-1', 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'MEDICAL_RECORD',
      entityId: 'rec-1',
      actionType: 'DELETE',
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: false },
      fieldsAfter: { isDeleted: true },
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.softDelete.mockRejectedValue(new Error('Not found'));
    await expect(medicalRecordService.softDelete('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('medicalRecordService.restore', () => {
  it('delegates to repository.restore', async () => {
    mockRepo.restore.mockResolvedValue(fakeRecord as any);
    const result = await medicalRecordService.restore('rec-1', 'user-1');
    expect(mockRepo.restore).toHaveBeenCalledWith('rec-1', 'user-1');
    expect(result).toEqual(fakeRecord);
  });

  it('calls logAudit after restore', async () => {
    mockRepo.restore.mockResolvedValue(fakeRecord as any);
    await medicalRecordService.restore('rec-1', 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'MEDICAL_RECORD',
      entityId: 'rec-1',
      actionType: 'RESTORE',
      affectedFields: ['isDeleted'],
      fieldsBefore: { isDeleted: true },
      fieldsAfter: { isDeleted: false },
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.restore.mockRejectedValue(new Error('Not found'));
    await expect(medicalRecordService.restore('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('medicalRecordService.delete', () => {
  it('delegates to repository.delete and returns { id }', async () => {
    mockRepo.delete.mockResolvedValue(fakeRecord as any);
    const result = await medicalRecordService.delete('rec-1', 'user-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('rec-1', 'user-1');
    expect(result).toEqual({ id: 'rec-1' });
  });

  it('calls logAudit after permanent delete', async () => {
    mockRepo.delete.mockResolvedValue(fakeRecord as any);
    await medicalRecordService.delete('rec-1', 'user-1');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'MEDICAL_RECORD',
      entityId: 'rec-1',
      actionType: 'DELETE',
    }));
  });

  it('propagates repository errors', async () => {
    mockRepo.delete.mockRejectedValue(new Error('Not found'));
    await expect(medicalRecordService.delete('bad', 'user-1')).rejects.toThrow('Not found');
  });
});
