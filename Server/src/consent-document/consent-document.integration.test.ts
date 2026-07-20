import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../prisma/prismaClient.js';
import { consentDocumentService } from './consent-document.service.js';
import { createTestUser } from '../../test/integration/helpers.js';
import { ConsentDocumentAlreadyExistsError, ConsentDocumentNotFoundError } from '../utils/errors.js';

let userId: string;
const SAMPLE_B64 = Buffer.from('hello consent pdf').toString('base64');

beforeEach(async () => {
  const u = await createTestUser();
  userId = u.id;
});

describe('consentDocumentService (integration)', () => {
  it('creates and reads back a consent document', async () => {
    const created = await consentDocumentService.create(
      { name: 'Consent.pdf', content: SAMPLE_B64, mimeType: 'application/pdf' },
      userId,
    );
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Consent.pdf');

    const content = await consentDocumentService.getContent(userId);
    const raw = content.content as unknown;
    const stored = typeof raw === 'string' && /^\d+(,\d+)*$/.test(raw)
      ? Buffer.from(raw.split(',').map(Number)).toString('utf8')
      : Buffer.from(raw as Uint8Array).toString('utf8');
    expect(stored).toBe(Buffer.from(SAMPLE_B64, 'base64').toString('utf8'));
    expect(content.mimeType).toBe('application/pdf');
  });

  it('rejects a second document for the same user', async () => {
    await consentDocumentService.create({ name: 'First.pdf', content: SAMPLE_B64, mimeType: 'application/pdf' }, userId);
    await expect(
      consentDocumentService.create({ name: 'Second.pdf', content: SAMPLE_B64, mimeType: 'application/pdf' }, userId),
    ).rejects.toThrow(ConsentDocumentAlreadyExistsError);
  });

  it('updates an existing document in place (no duplicate)', async () => {
    await consentDocumentService.create({ name: 'Orig.pdf', content: SAMPLE_B64, mimeType: 'application/pdf' }, userId);
    const updated = await consentDocumentService.update(userId, { name: 'Updated.pdf' });

    const all = await prisma.document.findMany({ where: { userId } });
    expect(all).toHaveLength(1);
    expect(updated.name).toBe('Updated.pdf');
  });

  it('scopes documents to the owning user (public getContentByUserId)', async () => {
    await consentDocumentService.create({ name: 'Owner.pdf', content: SAMPLE_B64, mimeType: 'application/pdf' }, userId);
    const other = await createTestUser();

    await expect(consentDocumentService.getContent(other.id)).rejects.toThrow(ConsentDocumentNotFoundError);

    const ownerContent = await consentDocumentService.getContentByUserId(userId);
    expect(ownerContent.id).toBeTruthy();
  });

  it('deletes a document', async () => {
    await consentDocumentService.create({ name: 'ToDelete.pdf', content: SAMPLE_B64, mimeType: 'application/pdf' }, userId);
    await consentDocumentService.delete(userId);
    await expect(consentDocumentService.getContent(userId)).rejects.toThrow(ConsentDocumentNotFoundError);
  });

  it('findByUserIdOrNull returns null when no document exists', async () => {
    const doc = await consentDocumentService.findByUserIdOrNull(userId);
    expect(doc).toBeNull();
  });

  it('findByUserIdOrNull returns the stored document for the owner', async () => {
    await consentDocumentService.create({ name: 'Owned.pdf', content: SAMPLE_B64, mimeType: 'application/pdf' }, userId);
    const doc = await consentDocumentService.findByUserIdOrNull(userId);
    expect(doc).not.toBeNull();
    expect(doc!.name).toBe('Owned.pdf');
  });

  it('getContentByUserId reads raw content and throws for unknown user', async () => {
    await consentDocumentService.create({ name: 'Raw.pdf', content: SAMPLE_B64, mimeType: 'application/pdf' }, userId);
    const content = await consentDocumentService.getContentByUserId(userId);

    const raw = content.content as unknown;
    const stored = typeof raw === 'string' && /^\d+(,\d+)*$/.test(raw)
      ? Buffer.from(raw.split(',').map(Number)).toString('utf8')
      : Buffer.from(raw as Uint8Array).toString('utf8');
    expect(stored).toBe(Buffer.from(SAMPLE_B64, 'base64').toString('utf8'));
    expect(content.mimeType).toBe('application/pdf');

    const other = await createTestUser();
    await expect(consentDocumentService.getContentByUserId(other.id))
      .rejects.toThrow(ConsentDocumentNotFoundError);
  });
});
