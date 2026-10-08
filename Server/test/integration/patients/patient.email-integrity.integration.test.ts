import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { patientRepository } from '../../../src/patients/patient.repository.js';
import { patientService } from '../../../src/patients/patient.service.js';
import { PatientEmailConflictError } from '../../../src/patients/patient.errors.js';
import { createPatientSchema, updatePatientSchema } from '../../../src/patients/patient.schemas.js';
import { createTestUser, unique } from '../helpers.js';

let userId: string;

beforeEach(async () => {
  userId = (await createTestUser()).id;
});

const base = (email: string | null) => ({
  name: 'Ana',
  lastName: 'Lopez',
  email,
  status: 'ACTIVE' as const,
});

describe('patient email normalization (schema)', () => {
  it('trims and lower-cases before validating', () => {
    const parsed = createPatientSchema.parse({ name: 'A', lastName: 'B', email: '  Ana.Lopez@Example.COM ' });
    expect(parsed.email).toBe('ana.lopez@example.com');
    expect(updatePatientSchema.parse({ email: ' X@Y.co ' }).email).toBe('x@y.co');
  });

  it('still rejects invalid emails and keeps null/undefined', () => {
    expect(createPatientSchema.safeParse({ name: 'A', lastName: 'B', email: 'nope' }).success).toBe(false);
    expect(createPatientSchema.parse({ name: 'A', lastName: 'B', email: null }).email).toBeNull();
    expect(createPatientSchema.parse({ name: 'A', lastName: 'B' }).email).toBeUndefined();
  });
});

describe('patient email uniqueness (integration)', () => {
  it('stores normalized emails and finds them regardless of input casing/whitespace', async () => {
    const email = unique('Mixed.Case@Test.Local');
    const created = await patientRepository.create(base(`  ${email}  `), userId);
    expect(created.email).toBe(email.toLowerCase());

    const found = await patientRepository.findByEmail(` ${email.toUpperCase()} `, userId);
    expect(found?.id).toBe(created.id);
  });

  it('rejects a second active patient whose email differs only by case/whitespace, without echoing it', async () => {
    const email = unique('dup@test.local');
    await patientRepository.create(base(email), userId);
    const err = await patientRepository.create(base(` ${email.toUpperCase()}`), userId).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PatientEmailConflictError);
    expect((err as Error).message).not.toContain(email);
  });

  it('enforces the index even for writes that bypass the repository', async () => {
    const email = unique('raw@test.local');
    await patientRepository.create(base(email), userId);
    await expect(
      prisma.patient.create({ data: { name: 'X', lastName: 'Y', email: `  ${email.toUpperCase()} `, userId } }),
    ).rejects.toBeTruthy();
  });

  it('lets different providers use the same email, and allows many patients without email', async () => {
    const email = unique('shared@test.local');
    const other = await createTestUser();
    await patientRepository.create(base(email), userId);
    await patientRepository.create(base(email), other.id);
    await patientRepository.create(base(null), userId);
    await patientRepository.create(base(null), userId);
  });

  it('ignores soft-deleted patients for uniqueness and findByEmail', async () => {
    const email = unique('deleted@test.local');
    const first = await patientRepository.create(base(email), userId);
    await patientService.delete(first.id, userId);
    expect(await patientRepository.findByEmail(email, userId)).toBeNull();
    const second = await patientRepository.create(base(email), userId);
    expect(second.id).not.toBe(first.id);
  });

  it('returns a 409 conflict (not a 500) when restoring into an email now used by an active patient', async () => {
    const email = unique('restore@test.local');
    const first = await patientRepository.create(base(email), userId);
    await patientService.delete(first.id, userId);
    await patientRepository.create(base(email), userId);
    await expect(patientService.restore(first.id, userId)).rejects.toBeInstanceOf(PatientEmailConflictError);
  });

  it('returns 409 on update to a taken email and no longer throws on a null-email conflict path', async () => {
    const a = await patientRepository.create(base(unique('a@test.local')), userId);
    const b = await patientRepository.create(base(unique('b@test.local')), userId);
    await expect(
      patientRepository.update(b.id, { email: a.email!.toUpperCase() }, userId),
    ).rejects.toBeInstanceOf(PatientEmailConflictError);
    // clearing the email is always allowed
    const cleared = await patientRepository.update(b.id, { email: null }, userId);
    expect(cleared.email).toBeNull();
  });
});
