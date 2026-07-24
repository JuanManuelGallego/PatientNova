import { describe, it, expect, vi, beforeEach } from 'vitest';
import { medicalRecordService } from '../../../src/medical-records/medical-record.service.js';

vi.mock('../../../src/utils/prisma/prisma-client.js', () => ({
  prisma: {
    patient: { findFirst: vi.fn() },
  },
}));

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

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { medicalRecordRepository } from '../../../src/medical-records/medical-record.repository.js';
import { logger } from '../../../src/utils/api/logger.js';

const mockPrisma = vi.mocked(prisma) as any;
const mockRepo = vi.mocked(medicalRecordRepository);
const mockLogger = vi.mocked(logger);

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
  it('creates a medical record when patient exists and has no record', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ id: 'patient-1', medicalRecord: null } as any);
    mockRepo.create.mockResolvedValue(fakeRecord as any);
    const dto = { patientId: 'patient-1', name: 'John Doe' };
    const result = await medicalRecordService.create(dto, 'user-1');
    expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith({
      where: { id: 'patient-1', userId: 'user-1' },
      include: { medicalRecord: true },
    });
    expect(mockRepo.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual(fakeRecord);
  });

  it('throws PatientNotFoundError when patient does not exist', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);
    const dto = { patientId: 'bad-id', name: 'John Doe' };
    await expect(medicalRecordService.create(dto, 'user-1')).rejects.toThrow('Patient with id "bad-id" not found');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('throws MedicalRecordAlreadyExistsError when patient already has a record', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: 'patient-1',
      medicalRecord: { id: 'existing-record' },
    } as any);
    const dto = { patientId: 'patient-1', name: 'John Doe' };
    await expect(medicalRecordService.create(dto, 'user-1')).rejects.toThrow('A medical record for patient with id "patient-1" already exists');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('enforces ownership — patient belonging to different user is not found', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);
    const dto = { patientId: 'patient-1', name: 'John Doe' };
    await expect(medicalRecordService.create(dto, 'other-user')).rejects.toThrow('Patient with id "patient-1" not found');
    expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith({
      where: { id: 'patient-1', userId: 'other-user' },
      include: { medicalRecord: true },
    });
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('logs medical record creation', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ id: 'patient-1', medicalRecord: null } as any);
    mockRepo.create.mockResolvedValue(fakeRecord as any);
    await medicalRecordService.create({ patientId: 'patient-1', name: 'John Doe' }, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { medicalRecordId: 'rec-1', patientId: 'patient-1', userId: 'user-1' },
      'Medical record created',
    );
  });

  it('propagates repository errors', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ id: 'patient-1', medicalRecord: null } as any);
    mockRepo.create.mockRejectedValue(new Error('DB error'));
    await expect(medicalRecordService.create({ patientId: 'patient-1', name: 'X' }, 'user-1')).rejects.toThrow('DB error');
  });
});

describe('medicalRecordService.update', () => {
  it('delegates to repository.update with id, dto, and userId', async () => {
    const dto = { name: 'Updated Name' };
    mockRepo.update.mockResolvedValue({ ...fakeRecord, ...dto } as any);
    const result = await medicalRecordService.update('rec-1', dto, 'user-1');
    expect(mockRepo.update).toHaveBeenCalledWith('rec-1', dto, 'user-1');
    expect(result.name).toBe('Updated Name');
  });

  it('logs medical record update with changed fields', async () => {
    mockRepo.update.mockResolvedValue(fakeRecord as any);
    await medicalRecordService.update('rec-1', { name: 'New' }, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { medicalRecordId: 'rec-1', userId: 'user-1', fields: ['name'] },
      'Medical record updated',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.update.mockRejectedValue(new Error('Not found'));
    await expect(medicalRecordService.update('bad', { name: 'X' }, 'user-1')).rejects.toThrow('Not found');
  });
});

describe('medicalRecordService.softDelete', () => {
  it('delegates to repository.softDelete with id and userId', async () => {
    mockRepo.softDelete.mockResolvedValue(fakeRecord as any);
    const result = await medicalRecordService.softDelete('rec-1', 'user-1');
    expect(mockRepo.softDelete).toHaveBeenCalledWith('rec-1', 'user-1');
    expect(result).toEqual(fakeRecord);
  });

  it('logs medical record deletion', async () => {
    mockRepo.softDelete.mockResolvedValue(fakeRecord as any);
    await medicalRecordService.softDelete('rec-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { medicalRecordId: 'rec-1', userId: 'user-1' },
      'Medical record deleted',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.softDelete.mockRejectedValue(new Error('Not found'));
    await expect(medicalRecordService.softDelete('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('medicalRecordService.restore', () => {
  it('delegates to repository.restore with id and userId', async () => {
    mockRepo.restore.mockResolvedValue(fakeRecord as any);
    const result = await medicalRecordService.restore('rec-1', 'user-1');
    expect(mockRepo.restore).toHaveBeenCalledWith('rec-1', 'user-1');
    expect(result).toEqual(fakeRecord);
  });

  it('logs medical record restoration', async () => {
    mockRepo.restore.mockResolvedValue(fakeRecord as any);
    await medicalRecordService.restore('rec-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { medicalRecordId: 'rec-1', userId: 'user-1' },
      'Medical record restored',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.restore.mockRejectedValue(new Error('Not found'));
    await expect(medicalRecordService.restore('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('medicalRecordService.delete', () => {
  it('delegates to repository.delete with id and userId', async () => {
    mockRepo.delete.mockResolvedValue(fakeRecord as any);
    const result = await medicalRecordService.delete('rec-1', 'user-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('rec-1', 'user-1');
    expect(result).toEqual(fakeRecord);
  });

  it('logs permanent medical record deletion', async () => {
    mockRepo.delete.mockResolvedValue(fakeRecord as any);
    await medicalRecordService.delete('rec-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { medicalRecordId: 'rec-1', userId: 'user-1' },
      'Medical record permanently deleted',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.delete.mockRejectedValue(new Error('Not found'));
    await expect(medicalRecordService.delete('bad', 'user-1')).rejects.toThrow('Not found');
  });
});
