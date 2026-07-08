// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userService } from './user.service.js';

vi.mock('./user.repository.js', () => ({
  userRepository: {
    findById: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { userRepository } from './user.repository.js';
import { logger } from '../utils/logger.js';

const mockRepo = vi.mocked(userRepository);
const mockLogger = vi.mocked(logger);

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'USER',
  status: 'ACTIVE',
};

beforeEach(() => vi.clearAllMocks());

describe('userService.findById', () => {
  it('delegates to repository.findById', async () => {
    mockRepo.findById.mockResolvedValue(fakeUser as any);
    const result = await userService.findById('user-1');
    expect(mockRepo.findById).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(fakeUser);
  });

  it('propagates repository errors', async () => {
    mockRepo.findById.mockRejectedValue(new Error('User with id "bad" not found'));
    await expect(userService.findById('bad')).rejects.toThrow('User with id "bad" not found');
  });
});

describe('userService.findMany', () => {
  it('delegates to repository.findMany', async () => {
    mockRepo.findMany.mockResolvedValue([fakeUser] as any);
    const result = await userService.findMany({ includeDeleted: false });
    expect(mockRepo.findMany).toHaveBeenCalledWith({ includeDeleted: false });
    expect(result).toEqual([fakeUser]);
  });
});

describe('userService.create', () => {
  it('delegates to repository.create and returns user', async () => {
    const dto = { email: 'new@example.com', firstName: 'Jane', password: 'pass123', role: 'USER' as const };
    mockRepo.create.mockResolvedValue(fakeUser as any);
    const result = await userService.create(dto);
    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(fakeUser);
  });

  it('logs user creation', async () => {
    const dto = { email: 'new@example.com', firstName: 'Jane', password: 'pass123', role: 'USER' as const };
    mockRepo.create.mockResolvedValue(fakeUser as any);
    await userService.create(dto);
    expect(mockLogger.info).toHaveBeenCalledWith(
      { userId: 'user-1', email: 'test@example.com' },
      'User created',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.create.mockRejectedValue(new Error('Email already exists'));
    await expect(userService.create({ email: 'dup@test.com', firstName: 'X', password: 'p', role: 'USER' })).rejects.toThrow('Email already exists');
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});

describe('userService.update', () => {
  it('delegates to repository.update and returns updated user', async () => {
    const dto = { firstName: 'Updated' };
    mockRepo.update.mockResolvedValue({ ...fakeUser, ...dto } as any);
    const result = await userService.update('user-1', dto);
    expect(mockRepo.update).toHaveBeenCalledWith('user-1', dto);
    expect(result.firstName).toBe('Updated');
  });

  it('logs user update with changed fields', async () => {
    const dto = { firstName: 'Updated', lastName: 'Name' };
    mockRepo.update.mockResolvedValue({ ...fakeUser, ...dto } as any);
    await userService.update('user-1', dto);
    expect(mockLogger.info).toHaveBeenCalledWith(
      { userId: 'user-1', fields: ['firstName', 'lastName'] },
      'User updated',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.update.mockRejectedValue(new Error('Not found'));
    await expect(userService.update('bad', { firstName: 'X' })).rejects.toThrow('Not found');
  });
});

describe('userService.delete', () => {
  it('delegates to repository.delete and returns deleted user', async () => {
    mockRepo.delete.mockResolvedValue(fakeUser as any);
    const result = await userService.delete('user-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(fakeUser);
  });

  it('logs user deletion', async () => {
    mockRepo.delete.mockResolvedValue(fakeUser as any);
    await userService.delete('user-1');
    expect(mockLogger.info).toHaveBeenCalledWith({ userId: 'user-1' }, 'User deleted');
  });

  it('propagates repository errors', async () => {
    mockRepo.delete.mockRejectedValue(new Error('Not found'));
    await expect(userService.delete('bad')).rejects.toThrow('Not found');
  });
});

describe('userService.restore', () => {
  it('delegates to repository.restore and returns restored user', async () => {
    mockRepo.restore.mockResolvedValue(fakeUser as any);
    const result = await userService.restore('user-1');
    expect(mockRepo.restore).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(fakeUser);
  });

  it('logs user restoration', async () => {
    mockRepo.restore.mockResolvedValue(fakeUser as any);
    await userService.restore('user-1');
    expect(mockLogger.info).toHaveBeenCalledWith({ userId: 'user-1' }, 'User restored');
  });

  it('propagates repository errors', async () => {
    mockRepo.restore.mockRejectedValue(new Error('Not found'));
    await expect(userService.restore('bad')).rejects.toThrow('Not found');
  });
});
