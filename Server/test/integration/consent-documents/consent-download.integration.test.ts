import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';

import app from '../../../src/app.js';
import { patientTypeService } from '../../../src/patient-types/patient-type.service.js';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { createTestUser } from '../helpers.js';

const pdf = (text: string) => Buffer.from(`%PDF-1.4 ${text}`).toString('base64');
let userId: string;
let defaultTypeId: string;
let clientIp: string;
let ipSeq = 0;

beforeEach(async () => {
  ({ id: userId, defaultPatientTypeId: defaultTypeId } = await createTestUser());
  // The download limiter is in-memory and keyed by client IP (trust proxy = 1 hop), so each test
  // gets its own IP: no test can drain another's budget, regardless of order or count.
  clientIp = `203.0.113.${++ipSeq}`;
});

const download = (id: string, ext: string) =>
  request(app).get(`/v1/consent-document/public/download/${id}.${ext}`).set('X-Forwarded-For', clientIp);

describe('public consent download', () => {
  it('serves a version by its id inline, with nosniff and the stored content type', async () => {
    const version = await patientTypeService.addVersion(userId, defaultTypeId, { name: 'Consent.pdf', content: pdf('v1') });
    const res = await download(version.id, 'pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toMatch(/^inline;/);
    expect(res.body.toString()).toBe('%PDF-1.4 v1');
  });

  it('keeps serving an older version by its id after a newer upload', async () => {
    const first = await patientTypeService.addVersion(userId, defaultTypeId, { name: 'Consent.pdf', content: pdf('v1') });
    await patientTypeService.addVersion(userId, defaultTypeId, { name: 'Consent.pdf', content: pdf('v2') });
    expect((await download(first.id, 'pdf')).body.toString()).toBe('%PDF-1.4 v1');
  });

  it("answers a legacy user-id link with the current version of the provider's default type", async () => {
    const other = await patientTypeService.create(userId, { name: 'Familia' });
    await patientTypeService.addVersion(userId, other.id, { name: 'Familia.pdf', content: pdf('family') });
    await patientTypeService.addVersion(userId, defaultTypeId, { name: 'Consent.pdf', content: pdf('v1') });
    await patientTypeService.addVersion(userId, defaultTypeId, { name: 'Consent.pdf', content: pdf('v2') });

    const res = await download(userId, 'pdf');
    expect(res.status).toBe(200);
    expect(res.body.toString()).toBe('%PDF-1.4 v2');
  });

  it('answers a neutral 404, without echoing the id, when a provider has no consent PDF', async () => {
    const res = await download(userId, 'pdf');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'Document not found' });
    expect(JSON.stringify(res.body)).not.toContain(userId);
  });

  it('still serves a migrated JPEG on jpg/jpeg, and a mismatching extension gets the neutral 404', async () => {
    const legacy = await prisma.consentDocumentVersion.create({
      data: { patientTypeId: defaultTypeId, version: 1, name: 'Scan.jpeg', content: new Uint8Array(Buffer.from('jpeg')), mimeType: 'image/jpeg', sizeBytes: 4 },
    });
    expect((await download(legacy.id, 'jpg')).status).toBe(200);
    expect((await download(legacy.id, 'JPEG')).status).toBe(200);

    const wrong = await download(legacy.id, 'pdf');
    expect(wrong.status).toBe(404);
    expect(wrong.body).toMatchObject({ success: false, error: 'Document not found' });
  });

  it('keeps rejecting unknown extensions, malformed ids and unknown ids', async () => {
    const version = await patientTypeService.addVersion(userId, defaultTypeId, { name: 'Consent.pdf', content: pdf('v1') });
    expect((await download(version.id, 'exe')).status).toBe(400);
    expect((await download('not-a-cuid', 'pdf')).status).toBe(400);
    expect((await download('c' + 'x'.repeat(24), 'pdf')).status).toBe(404);
  });

  it('has its own per-client rate limit (20 per minute per IP, in-memory per instance)', async () => {
    const version = await patientTypeService.addVersion(userId, defaultTypeId, { name: 'Consent.pdf', content: pdf('v1') });
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await download(version.id, 'pdf')).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[ 20 ]).toBe(429);

    // Another client is unaffected.
    clientIp = '198.51.100.7';
    expect((await download(version.id, 'pdf')).status).toBe(200);
  });
});
