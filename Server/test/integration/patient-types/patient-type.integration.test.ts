import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../../../src/app.js';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { patientTypeService, CONSENT_PDF_MAX_BYTES } from '../../../src/patient-types/patient-type.service.js';
import {
  ConsentVersionNotFoundError,
  ConsentVersionNotPdfError,
  ConsentVersionTooLargeError,
  PatientTypeInUseError,
  PatientTypeIsDefaultError,
  PatientTypeNameConflictError,
  PatientTypeNotFoundError,
} from '../../../src/patient-types/patient-type.errors.js';
import { patientTypeRouter } from '../../../src/patient-types/patient-type.routes.js';
import { createUserWithDefaultType } from '../../../src/patient-types/patient-type.repository.js';
import { userService } from '../../../src/users/user.service.js';
import { AdminRole, AdminStatus } from '../../../generated/prisma/client.ts';
import { authReq, createTestPatient, createTestToken, createTestUser, invokeRoute, unique } from '../helpers.js';

const pdf = (text = 'consent') => Buffer.from(`%PDF-1.4 ${text}`).toString('base64');

let user: Awaited<ReturnType<typeof createTestUser>>;
let userId: string;
let defaultTypeId: string;

beforeEach(async () => {
  user = await createTestUser();
  ({ id: userId, defaultPatientTypeId: defaultTypeId } = user);
});

describe('new accounts', () => {
  it('start with one default patient type, "General", with an empty template', async () => {
    const created = await userService.create({
      email: unique('nuevo@test.local'),
      password: 'Password123!',
      firstName: 'Nueva',
      lastName: 'Cuenta',
      role: AdminRole.ADMIN,
      status: AdminStatus.ACTIVE,
    }, userId);

    const types = await patientTypeService.list(created.id);
    expect(types).toHaveLength(1);
    expect(types[ 0 ]).toMatchObject({ name: 'General', isDefault: true, template: { sections: [] }, patientCount: 0, currentVersion: null });
    expect(created.defaultPatientTypeId).toBe(types[ 0 ]!.id);
  });

  it('refuses a user whose default type is never written (the foreign key is checked at commit)', async () => {
    await expect(prisma.user.create({
      data: { email: unique('bare@test.local'), passwordHash: 'x', defaultPatientTypeId: randomUUID() },
    })).rejects.toThrow();
    expect(await prisma.user.count({ where: { email: { startsWith: 'bare@test.local' } } })).toBe(0);
  });

  it('keeps the default of an existing user when an upsert finds it', async () => {
    const before = await prisma.patientType.count({ where: { userId } });
    const found = await prisma.$transaction((tx) => createUserWithDefaultType(tx, (defaultPatientTypeId) => tx.user.upsert({
      where: { id: userId },
      update: {},
      create: { email: unique('never@test.local'), passwordHash: 'x', defaultPatientTypeId },
    })));
    expect(found.defaultPatientTypeId).toBe(defaultTypeId);
    expect(await prisma.patientType.count({ where: { userId } })).toBe(before);
  });
});

describe('patientTypeService', () => {
  it('lists types with the default, the patient count (soft-deleted included) and the current version', async () => {
    const family = await patientTypeService.create(userId, { name: 'Familia' });
    await createTestPatient(userId);
    const deleted = await createTestPatient(userId, { patientTypeId: family.id });
    await prisma.patient.update({ where: { id: deleted.id }, data: { isDeleted: true, deletedAt: new Date() } });
    await patientTypeService.addVersion(userId, family.id, { name: 'v1.pdf', content: pdf('1') });
    const v2 = await patientTypeService.addVersion(userId, family.id, { name: 'v2.pdf', content: pdf('2') });

    const types = await patientTypeService.list(userId);
    expect(types.map((t) => t.name)).toEqual([ 'General', 'Familia' ]);
    expect(types[ 0 ]).toMatchObject({ isDefault: true, patientCount: 1, currentVersion: null });
    expect(types[ 1 ]).toMatchObject({ isDefault: false, patientCount: 1, currentVersion: { id: v2.id, version: 2, name: 'v2.pdf', url: expect.stringMatching(new RegExp(`/v1/consent-document/public/download/${v2.id}\\.pdf$`)) } });
    expect(types[ 1 ]!.currentVersion).not.toHaveProperty('content');
  });

  it('refuses a duplicate name for the same provider, but not across providers', async () => {
    await patientTypeService.create(userId, { name: 'Familia' });
    await expect(patientTypeService.create(userId, { name: 'Familia' })).rejects.toBeInstanceOf(PatientTypeNameConflictError);
    const general = await patientTypeService.create(userId, { name: 'Pareja' });
    await expect(patientTypeService.update(userId, general.id, { name: 'Familia' })).rejects.toBeInstanceOf(PatientTypeNameConflictError);

    const other = await createTestUser();
    await expect(patientTypeService.create(other.id, { name: 'Familia' })).resolves.toMatchObject({ name: 'Familia' });
  });

  it('treats names that differ only in letter case as the same, but lets a type change its own case', async () => {
    const familia = await patientTypeService.create(userId, { name: 'Familia' });
    await expect(patientTypeService.create(userId, { name: 'familia' })).rejects.toBeInstanceOf(PatientTypeNameConflictError);
    const pareja = await patientTypeService.create(userId, { name: 'Pareja' });
    await expect(patientTypeService.update(userId, pareja.id, { name: 'FAMILIA' })).rejects.toBeInstanceOf(PatientTypeNameConflictError);

    await expect(patientTypeService.update(userId, familia.id, { name: 'familia' })).resolves.toMatchObject({ name: 'familia' });
  });

  it('renames a type', async () => {
    const type = await patientTypeService.create(userId, { name: 'Pareja' });
    expect(await patientTypeService.update(userId, type.id, { name: 'Terapia de pareja' })).toMatchObject({ name: 'Terapia de pareja' });
  });

  it('changes the default type', async () => {
    const family = await patientTypeService.create(userId, { name: 'Familia' });
    expect(await patientTypeService.setDefault(userId, family.id)).toMatchObject({ isDefault: true });
    const types = await patientTypeService.list(userId);
    expect(types.filter((t) => t.isDefault).map((t) => t.id)).toEqual([ family.id ]);
  });

  describe('delete', () => {
    it('refuses the default type', async () => {
      await expect(patientTypeService.delete(userId, defaultTypeId)).rejects.toBeInstanceOf(PatientTypeIsDefaultError);
    });

    it('refuses while a patient uses it, counting soft-deleted patients', async () => {
      const family = await patientTypeService.create(userId, { name: 'Familia' });
      const patient = await createTestPatient(userId, { patientTypeId: family.id });
      await prisma.patient.update({ where: { id: patient.id }, data: { isDeleted: true, deletedAt: new Date() } });

      const err = await patientTypeService.delete(userId, family.id).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PatientTypeInUseError);
      expect((err as PatientTypeInUseError).patientCount).toBe(1);
      expect((err as Error).message).toContain('1 paciente');
    });

    it('deletes an unused type together with its consent versions', async () => {
      const family = await patientTypeService.create(userId, { name: 'Familia' });
      const version = await patientTypeService.addVersion(userId, family.id, { name: 'v1.pdf', content: pdf() });
      await patientTypeService.delete(userId, family.id);
      expect(await prisma.patientType.findUnique({ where: { id: family.id } })).toBeNull();
      expect(await prisma.consentDocumentVersion.findUnique({ where: { id: version.id } })).toBeNull();
    });
  });

  describe('consent versions', () => {
    it('numbers uploads 1, 2, … and keeps every version', async () => {
      const v1 = await patientTypeService.addVersion(userId, defaultTypeId, { name: 'Consent.pdf', content: pdf('1') });
      const v2 = await patientTypeService.addVersion(userId, defaultTypeId, { name: 'Consent.pdf', content: `data:application/pdf;base64,${pdf('2')}` });
      expect([ v1.version, v2.version ]).toEqual([ 1, 2 ]);
      expect(v1.id).toMatch(/^c[a-z0-9]{24}$/);
      expect((await patientTypeService.listVersions(userId, defaultTypeId)).map((v) => v.version)).toEqual([ 2, 1 ]);

      const first = await patientTypeService.getVersionContent(userId, defaultTypeId, v1.id);
      expect(Buffer.from(first.content).toString()).toBe('%PDF-1.4 1');
      const second = await patientTypeService.getVersionContent(userId, defaultTypeId, v2.id);
      expect(Buffer.from(second.content).toString()).toBe('%PDF-1.4 2');
      expect(second.mimeType).toBe('application/pdf');
    });

    it('accepts only PDF bytes, whatever the name says', async () => {
      const png = Buffer.from('\x89PNG\r\n\x1a\n not a pdf').toString('base64');
      await expect(patientTypeService.addVersion(userId, defaultTypeId, { name: 'Consent.pdf', content: png }))
        .rejects.toBeInstanceOf(ConsentVersionNotPdfError);
      expect(await prisma.consentDocumentVersion.count()).toBe(0);
    });

    it('refuses a file over the size limit', async () => {
      const big = Buffer.concat([ Buffer.from('%PDF-'), Buffer.alloc(CONSENT_PDF_MAX_BYTES) ]).toString('base64');
      await expect(patientTypeService.addVersion(userId, defaultTypeId, { name: 'Big.pdf', content: big }))
        .rejects.toBeInstanceOf(ConsentVersionTooLargeError);
    });
  });

  it("never reaches another provider's types or versions", async () => {
    const other = await createTestUser();
    const version = await patientTypeService.addVersion(other.id, other.defaultPatientTypeId, { name: 'Other.pdf', content: pdf() });
    const theirs = other.defaultPatientTypeId;

    await expect(patientTypeService.update(userId, theirs, { name: 'Mine' })).rejects.toBeInstanceOf(PatientTypeNotFoundError);
    await expect(patientTypeService.setDefault(userId, theirs)).rejects.toBeInstanceOf(PatientTypeNotFoundError);
    await expect(patientTypeService.delete(userId, theirs)).rejects.toBeInstanceOf(PatientTypeNotFoundError);
    await expect(patientTypeService.listVersions(userId, theirs)).rejects.toBeInstanceOf(PatientTypeNotFoundError);
    await expect(patientTypeService.addVersion(userId, theirs, { name: 'x.pdf', content: pdf() })).rejects.toBeInstanceOf(PatientTypeNotFoundError);
    await expect(patientTypeService.getVersionContent(userId, theirs, version.id)).rejects.toBeInstanceOf(PatientTypeNotFoundError);
    await expect(patientTypeService.getVersionContent(userId, defaultTypeId, version.id)).rejects.toBeInstanceOf(ConsentVersionNotFoundError);
    expect((await patientTypeService.list(userId)).map((t) => t.id)).not.toContain(theirs);
  });
});

describe('patient type routes', () => {
  it('creates a type (201) and validates the name', async () => {
    const created = await invokeRoute(patientTypeRouter, 'post', '/', { ...authReq(user), body: { name: '  Nutrición  ' } });
    expect(created.statusCode).toBe(201);
    expect(created.body.data).toMatchObject({ name: 'Nutrición', isDefault: false });

    const empty = await invokeRoute(patientTypeRouter, 'post', '/', { ...authReq(user), body: { name: '   ' } });
    expect(empty.statusCode).toBe(400);
  });

  it('answers 409 with the count when deleting a type in use', async () => {
    const res = await invokeRoute(patientTypeRouter, 'delete', `/${defaultTypeId}`, { ...authReq(user), params: { id: defaultTypeId } });
    expect(res.statusCode).toBe(409);
  });

  it('uploads a version (201) and serves its bytes on the authenticated download', async () => {
    const upload = await invokeRoute(patientTypeRouter, 'post', `/${defaultTypeId}/consent-versions`, {
      ...authReq(user),
      params: { id: defaultTypeId },
      body: { name: 'Consent.pdf', content: pdf('route') },
    });
    expect(upload.statusCode).toBe(201);
    const versionId = upload.body.data.id as string;

    const res = await request(app)
      .get(`/v1/patient-types/${defaultTypeId}/consent-versions/${versionId}/download`)
      .set('Authorization', `Bearer ${createTestToken(user)}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/^attachment;/);
    expect(res.body.toString()).toBe('%PDF-1.4 route');
  });

  it('lets a VIEWER read the types but not change them', async () => {
    const viewer = await createTestUser({ role: AdminRole.VIEWER });
    const token = createTestToken(viewer);
    const list = await request(app).get('/v1/patient-types').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const create = await request(app).post('/v1/patient-types').set('Authorization', `Bearer ${token}`).send({ name: 'Nueva' });
    expect(create.status).toBe(403);
    const upload = await request(app)
      .post(`/v1/patient-types/${viewer.defaultPatientTypeId}/consent-versions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'x.pdf', content: pdf() });
    expect(upload.status).toBe(403);
  });

  it('accepts a consent PDF larger than the global 100kb body limit', async () => {
    const big = Buffer.concat([ Buffer.from('%PDF-1.4 '), Buffer.alloc(300 * 1024, 'a') ]).toString('base64');
    const res = await request(app)
      .post(`/v1/patient-types/${defaultTypeId}/consent-versions`)
      .set('Authorization', `Bearer ${createTestToken(user)}`)
      .send({ name: 'Big.pdf', content: big });
    expect(res.status).toBe(201);
  });
});
