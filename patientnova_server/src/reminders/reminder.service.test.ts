// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reminderService } from './reminder.service.js';

vi.mock('./reminder.repository.js', () => ({
  reminderRepository: {
    findById: vi.fn(),
    findMany: vi.fn(),
    getStats: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { reminderRepository } from './reminder.repository.js';
import { logger } from '../utils/logger.js';

const mockRepo = vi.mocked(reminderRepository);
const mockLogger = vi.mocked(logger);

const fakeReminder = {
  id: 'rem-1',
  channel: 'WHATSAPP',
  to: '+15551234567',
  sendMode: 'IMMEDIATE',
  status: 'PENDING',
  patientId: 'patient-1',
  userId: 'user-1',
  sendAt: new Date(),
  createdAt: new Date(),
};

beforeEach(() => vi.clearAllMocks());

describe('reminderService.findById', () => {
  it('delegates to repository.findById', async () => {
    mockRepo.findById.mockResolvedValue(fakeReminder as any);
    const result = await reminderService.findById('rem-1');
    expect(mockRepo.findById).toHaveBeenCalledWith('rem-1');
    expect(result).toEqual(fakeReminder);
  });

  it('propagates repository errors', async () => {
    mockRepo.findById.mockRejectedValue(new Error('Reminder with id "bad" not found'));
    await expect(reminderService.findById('bad')).rejects.toThrow('Reminder with id "bad" not found');
  });
});

describe('reminderService.findMany', () => {
  it('delegates to repository.findMany with query and userId', async () => {
    mockRepo.findMany.mockResolvedValue({ items: [fakeReminder], total: 1 } as any);
    const query = { page: 1, pageSize: 10, orderBy: 'sendAt', order: 'desc' as const, search: '' };
    const result = await reminderService.findMany(query, 'user-1');
    expect(mockRepo.findMany).toHaveBeenCalledWith(query, 'user-1');
    expect(result.items).toHaveLength(1);
  });

  it('returns empty results when no reminders match', async () => {
    mockRepo.findMany.mockResolvedValue({ items: [], total: 0 } as any);
    const result = await reminderService.findMany({ page: 1, pageSize: 10, search: 'xyz', orderBy: 'sendAt', order: 'desc' as const }, 'user-1');
    expect(result.items).toHaveLength(0);
  });
});

describe('reminderService.getStats', () => {
  it('delegates to repository.getStats with query and userId', async () => {
    mockRepo.getStats.mockResolvedValue({ total: 10, todayCount: 2, byStatus: {}, byChannel: {} } as any);
    const query = { dateFrom: '2024-01-01', dateTo: '2024-12-31' };
    const result = await reminderService.getStats(query, 'user-1');
    expect(mockRepo.getStats).toHaveBeenCalledWith(query, 'user-1');
    expect(result.total).toBe(10);
  });

  it('propagates repository errors', async () => {
    mockRepo.getStats.mockRejectedValue(new Error('DB error'));
    await expect(reminderService.getStats({}, 'user-1')).rejects.toThrow('DB error');
  });
});

describe('reminderService.create', () => {
  it('creates an IMMEDIATE reminder successfully', async () => {
    const dto = { channel: 'WHATSAPP' as const, to: '+15551234567', sendMode: 'IMMEDIATE' as const, patientId: 'patient-1', status: 'PENDING' as const, sendAt: new Date().toISOString() };
    mockRepo.create.mockResolvedValue(fakeReminder as any);
    const result = await reminderService.create(dto, 'user-1');
    expect(mockRepo.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual(fakeReminder);
  });

  it('creates a SCHEDULED reminder with future sendAt', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const dto = { channel: 'SMS' as const, to: '+15559876543', sendMode: 'SCHEDULED' as const, patientId: 'patient-1', status: 'PENDING' as const, sendAt: futureDate };
    mockRepo.create.mockResolvedValue(fakeReminder as any);
    const result = await reminderService.create(dto, 'user-1');
    expect(mockRepo.create).toHaveBeenCalled();
    expect(result).toEqual(fakeReminder);
  });

  it('throws ReminderSendAtInPastError for SCHEDULED reminder with past sendAt', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const dto = { channel: 'WHATSAPP' as const, to: '+15551234567', sendMode: 'SCHEDULED' as const, patientId: 'patient-1', status: 'PENDING' as const, sendAt: pastDate };
    await expect(reminderService.create(dto, 'user-1')).rejects.toThrow('Scheduled reminders must have a sendAt time in the future');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('throws ReminderSendAtInPastError for SCHEDULED reminder with sendAt exactly now', async () => {
    const now = new Date().toISOString();
    const dto = { channel: 'WHATSAPP' as const, to: '+15551234567', sendMode: 'SCHEDULED' as const, patientId: 'patient-1', status: 'PENDING' as const, sendAt: now };
    await expect(reminderService.create(dto, 'user-1')).rejects.toThrow('Scheduled reminders must have a sendAt time in the future');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('throws ReminderSendAtInPastError for SCHEDULED reminder when sendAt is null', async () => {
    const dto = { channel: 'WHATSAPP' as const, to: '+15551234567', sendMode: 'SCHEDULED' as const, patientId: 'patient-1', status: 'PENDING' as const, sendAt: null as any };
    await expect(reminderService.create(dto, 'user-1')).rejects.toThrow('Scheduled reminders must have a sendAt time in the future');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('logs reminder creation', async () => {
    const dto = { channel: 'WHATSAPP' as const, to: '+15551234567', sendMode: 'IMMEDIATE' as const, patientId: 'patient-1', status: 'PENDING' as const, sendAt: new Date().toISOString() };
    mockRepo.create.mockResolvedValue(fakeReminder as any);
    await reminderService.create(dto, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { reminderId: 'rem-1', userId: 'user-1', mode: 'IMMEDIATE' },
      'Reminder created',
    );
  });

  it('propagates repository errors', async () => {
    const dto = { channel: 'WHATSAPP' as const, to: '+15551234567', sendMode: 'IMMEDIATE' as const, patientId: 'patient-1', status: 'PENDING' as const, sendAt: new Date().toISOString() };
    mockRepo.create.mockRejectedValue(new Error('Patient not found'));
    await expect(reminderService.create(dto, 'user-1')).rejects.toThrow('Patient not found');
  });
});

describe('reminderService.update', () => {
  it('delegates to repository.update with id, dto, and userId', async () => {
    const dto = { channel: 'SMS' as const };
    mockRepo.update.mockResolvedValue({ ...fakeReminder, ...dto } as any);
    const result = await reminderService.update('rem-1', dto, 'user-1');
    expect(mockRepo.update).toHaveBeenCalledWith('rem-1', dto, 'user-1');
    expect(result.channel).toBe('SMS');
  });

  it('logs reminder update with changed fields', async () => {
    mockRepo.update.mockResolvedValue(fakeReminder as any);
    await reminderService.update('rem-1', { channel: 'SMS', to: '+15550000000' }, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { reminderId: 'rem-1', userId: 'user-1', fields: ['channel', 'to'] },
      'Reminder updated',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.update.mockRejectedValue(new Error('Not found'));
    await expect(reminderService.update('bad', { channel: 'SMS' }, 'user-1')).rejects.toThrow('Not found');
  });
});

describe('reminderService.cancel', () => {
  it('cancels a PENDING reminder', async () => {
    mockRepo.findById.mockResolvedValue(fakeReminder as any);
    mockRepo.cancel.mockResolvedValue({ ...fakeReminder, status: 'CANCELLED' } as any);
    const result = await reminderService.cancel('rem-1', 'user-1');
    expect(mockRepo.findById).toHaveBeenCalledWith('rem-1', 'user-1');
    expect(mockRepo.cancel).toHaveBeenCalledWith('rem-1', 'user-1');
    expect(result.status).toBe('CANCELLED');
  });

  it('throws ReminderNotCancellableError for SENT reminder', async () => {
    mockRepo.findById.mockResolvedValue({ ...fakeReminder, status: 'SENT' } as any);
    await expect(reminderService.cancel('rem-1', 'user-1')).rejects.toThrow('Cannot cancel a reminder with status "SENT"');
    expect(mockRepo.cancel).not.toHaveBeenCalled();
  });

  it('throws ReminderNotCancellableError for FAILED reminder', async () => {
    mockRepo.findById.mockResolvedValue({ ...fakeReminder, status: 'FAILED' } as any);
    await expect(reminderService.cancel('rem-1', 'user-1')).rejects.toThrow('Cannot cancel a reminder with status "FAILED"');
    expect(mockRepo.cancel).not.toHaveBeenCalled();
  });

  it('throws ReminderNotCancellableError for CANCELLED reminder', async () => {
    mockRepo.findById.mockResolvedValue({ ...fakeReminder, status: 'CANCELLED' } as any);
    await expect(reminderService.cancel('rem-1', 'user-1')).rejects.toThrow('Cannot cancel a reminder with status "CANCELLED"');
    expect(mockRepo.cancel).not.toHaveBeenCalled();
  });

  it('logs reminder cancellation', async () => {
    mockRepo.findById.mockResolvedValue(fakeReminder as any);
    mockRepo.cancel.mockResolvedValue({ ...fakeReminder, status: 'CANCELLED' } as any);
    await reminderService.cancel('rem-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith({ reminderId: 'rem-1', userId: 'user-1' }, 'Reminder cancelled');
  });

  it('propagates findById errors', async () => {
    mockRepo.findById.mockRejectedValue(new Error('Not found'));
    await expect(reminderService.cancel('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('reminderService.softDelete', () => {
  it('delegates to repository.delete with id and userId', async () => {
    mockRepo.delete.mockResolvedValue(fakeReminder as any);
    const result = await reminderService.softDelete('rem-1', 'user-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('rem-1', 'user-1');
    expect(result).toEqual(fakeReminder);
  });

  it('logs reminder deletion', async () => {
    mockRepo.delete.mockResolvedValue(fakeReminder as any);
    await reminderService.softDelete('rem-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith({ reminderId: 'rem-1', userId: 'user-1' }, 'Reminder deleted');
  });

  it('propagates repository errors', async () => {
    mockRepo.delete.mockRejectedValue(new Error('Not found'));
    await expect(reminderService.softDelete('bad', 'user-1')).rejects.toThrow('Not found');
  });
});

describe('reminderService.restore', () => {
  it('delegates to repository.restore with id and userId', async () => {
    mockRepo.restore.mockResolvedValue(fakeReminder as any);
    const result = await reminderService.restore('rem-1', 'user-1');
    expect(mockRepo.restore).toHaveBeenCalledWith('rem-1', 'user-1');
    expect(result).toEqual(fakeReminder);
  });

  it('logs reminder restoration', async () => {
    mockRepo.restore.mockResolvedValue(fakeReminder as any);
    await reminderService.restore('rem-1', 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith({ reminderId: 'rem-1', userId: 'user-1' }, 'Reminder restored');
  });

  it('propagates repository errors', async () => {
    mockRepo.restore.mockRejectedValue(new Error('Not found'));
    await expect(reminderService.restore('bad', 'user-1')).rejects.toThrow('Not found');
  });
});
