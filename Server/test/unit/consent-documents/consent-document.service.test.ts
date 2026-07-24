// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { consentDocumentService } from '../../../src/consent-documents/consent-document.service.js';

vi.mock('../../../src/consent-documents/consent-document.repository.js', () => ({
  consentDocumentRepository: {
    findByUserIdOrNull: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getContent: vi.fn(),
    getContentByUserId: vi.fn(),
  },
}));

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { consentDocumentRepository } from '../../../src/consent-documents/consent-document.repository.js';
import { logger } from '../../../src/utils/api/logger.js';

const mockRepo = vi.mocked(consentDocumentRepository);
const mockLogger = vi.mocked(logger);

const fakeDoc = {
  id: 'doc-1',
  userId: 'user-1',
  name: 'Consent Form',
  mimeType: 'application/pdf',
  content: Buffer.from('test content'),
  sizeBytes: 12,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => vi.clearAllMocks());

describe('consentDocumentService.findByUserIdOrNull', () => {
  it('delegates to repository.findByUserIdOrNull', async () => {
    mockRepo.findByUserIdOrNull.mockResolvedValue(fakeDoc as any);
    const result = await consentDocumentService.findByUserIdOrNull('user-1');
    expect(mockRepo.findByUserIdOrNull).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(fakeDoc);
  });

  it('returns null when no document exists', async () => {
    mockRepo.findByUserIdOrNull.mockResolvedValue(null);
    const result = await consentDocumentService.findByUserIdOrNull('user-1');
    expect(result).toBeNull();
  });
});

describe('consentDocumentService.create', () => {
  it('delegates to repository.create with dto and userId', async () => {
    const dto = { name: 'New Form', content: 'base64content', mimeType: 'application/pdf' };
    mockRepo.create.mockResolvedValue(fakeDoc as any);
    const result = await consentDocumentService.create(dto, 'user-1');
    expect(mockRepo.create).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual(fakeDoc);
  });

  it('logs consent document creation', async () => {
    mockRepo.create.mockResolvedValue(fakeDoc as any);
    await consentDocumentService.create({ name: 'Form', content: 'c', mimeType: 'pdf' }, 'user-1');
    expect(mockLogger.info).toHaveBeenCalledWith({ userId: 'user-1' }, 'Consent document created');
  });

  it('propagates repository errors', async () => {
    mockRepo.create.mockRejectedValue(new Error('Document already exists'));
    await expect(consentDocumentService.create({ name: 'Dup', content: 'c', mimeType: 'pdf' }, 'user-1')).rejects.toThrow('Document already exists');
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});

describe('consentDocumentService.update', () => {
  it('delegates to repository.update with userId and dto', async () => {
    const dto = { name: 'Updated Form' };
    mockRepo.update.mockResolvedValue({ ...fakeDoc, ...dto } as any);
    const result = await consentDocumentService.update('user-1', dto);
    expect(mockRepo.update).toHaveBeenCalledWith('user-1', dto);
    expect(result.name).toBe('Updated Form');
  });

  it('logs consent document update with changed fields', async () => {
    mockRepo.update.mockResolvedValue(fakeDoc as any);
    await consentDocumentService.update('user-1', { name: 'New', mimeType: 'text/plain' });
    expect(mockLogger.info).toHaveBeenCalledWith(
      { userId: 'user-1', fields: ['name', 'mimeType'] },
      'Consent document updated',
    );
  });

  it('propagates repository errors', async () => {
    mockRepo.update.mockRejectedValue(new Error('Not found'));
    await expect(consentDocumentService.update('user-1', { name: 'X' })).rejects.toThrow('Not found');
  });
});

describe('consentDocumentService.delete', () => {
  it('delegates to repository.delete with userId', async () => {
    mockRepo.delete.mockResolvedValue(fakeDoc as any);
    const result = await consentDocumentService.delete('user-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(fakeDoc);
  });

  it('logs consent document deletion', async () => {
    mockRepo.delete.mockResolvedValue(fakeDoc as any);
    await consentDocumentService.delete('user-1');
    expect(mockLogger.info).toHaveBeenCalledWith({ userId: 'user-1' }, 'Consent document deleted');
  });

  it('propagates repository errors', async () => {
    mockRepo.delete.mockRejectedValue(new Error('Not found'));
    await expect(consentDocumentService.delete('user-1')).rejects.toThrow('Not found');
  });
});

describe('consentDocumentService.getContent', () => {
  it('delegates to repository.getContent with userId', async () => {
    const content = { id: 'doc-1', name: 'Form', mimeType: 'pdf', content: 'base64data', sizeBytes: 10, createdAt: new Date(), updatedAt: new Date() };
    mockRepo.getContent.mockResolvedValue(content as any);
    const result = await consentDocumentService.getContent('user-1');
    expect(mockRepo.getContent).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(content);
  });
});

describe('consentDocumentService.getContentByUserId', () => {
  it('delegates to repository.getContentByUserId with userId', async () => {
    const content = { id: 'doc-1', name: 'Form', mimeType: 'pdf', content: Buffer.from('data'), sizeBytes: 10, createdAt: new Date(), updatedAt: new Date() };
    mockRepo.getContentByUserId.mockResolvedValue(content as any);
    const result = await consentDocumentService.getContentByUserId('user-1');
    expect(mockRepo.getContentByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(content);
  });
});
