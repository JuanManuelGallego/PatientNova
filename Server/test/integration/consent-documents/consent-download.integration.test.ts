import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';

import app from '../../../src/app.js';
import { consentDocumentService } from '../../../src/consent-documents/consent-document.service.js';
import { createTestUser } from '../helpers.js';

const B64 = Buffer.from('%PDF-1.4 fake consent').toString('base64');
let userId: string;

beforeEach(async () => {
  userId = (await createTestUser()).id;
});

const download = (id: string, ext: string) => request(app).get(`/v1/consent-document/public/download/${id}.${ext}`);

describe('public consent download', () => {
  it('serves the document inline with nosniff and the stored content type', async () => {
    await consentDocumentService.create({ name: 'Consent.pdf', content: B64, mimeType: 'application/pdf' }, userId);
    const res = await download(userId, 'pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toMatch(/^inline;/);
    expect(res.body.toString()).toContain('%PDF-1.4');
  });

  it('accepts jpg and jpeg for JPEG images but rejects a mismatching extension with a neutral 404', async () => {
    await consentDocumentService.create({ name: 'Scan.jpeg', content: B64, mimeType: 'image/jpeg' }, userId);
    expect((await download(userId, 'jpg')).status).toBe(200);
    expect((await download(userId, 'JPEG')).status).toBe(200);

    const wrong = await download(userId, 'pdf');
    expect(wrong.status).toBe(404);
    expect(wrong.body).toMatchObject({ success: false, error: 'Document not found' });
    expect((await download(userId, 'png')).status).toBe(404);
  });

  it('keeps rejecting unknown extensions, malformed ids and unknown users', async () => {
    await consentDocumentService.create({ name: 'Consent.pdf', content: B64, mimeType: 'application/pdf' }, userId);
    expect((await download(userId, 'exe')).status).toBe(400);
    expect((await download('not-a-cuid', 'pdf')).status).toBe(400);
    expect((await download('c' + 'x'.repeat(24), 'pdf')).status).toBe(404);
  });

  it('has its own shared-store rate limit (20 per minute per client)', async () => {
    await consentDocumentService.create({ name: 'Consent.pdf', content: B64, mimeType: 'application/pdf' }, userId);
    let limited = 0;
    for (let i = 0; i < 24; i++) {
      const res = await download(userId, 'pdf');
      if (res.status === 429) limited++;
    }
    expect(limited).toBeGreaterThan(0);
  });
});
