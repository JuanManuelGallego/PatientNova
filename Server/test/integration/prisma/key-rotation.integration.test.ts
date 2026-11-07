import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { createKeyring, decrypt, keyId } from '../../../src/utils/encryption/field-encryption.js';
import { PII_VERSION } from '../../../src/utils/encryption/blind-index.js';
import { sealV2 } from '../../ciphertext-fixtures.js';
import { createTestPatient, createTestUser } from '../helpers.js';
import { useKeys } from './use-keys.js';

const OLD_KEY = process.env.ENCRYPTION_KEY ?? '';
if (!OLD_KEY.trim()) throw new Error('ENCRYPTION_KEY must be set for key rotation tests (see .env.test)');
const NEW_KEY = 'c'.repeat(64);

describe('key rotation through the keyring', () => {
  let userId: string;
  let close: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    userId = (await createTestUser()).id;
  });

  afterEach(async () => {
    await close?.();
    close = undefined;
    vi.unstubAllEnvs();
  });

  async function rotate() {
    const rotated = await useKeys({ current: NEW_KEY, previous: OLD_KEY });
    close = rotated.close;
    return rotated;
  }

  it('reads a row written under the previous key', async () => {
    const patient = await createTestPatient(userId, { name: 'Ana' });
    const [ raw ] = await prisma.$queryRaw<{ name: string }[]>`
      SELECT "name" FROM patients WHERE id = ${patient.id}::uuid`;
    expect(raw!.name.startsWith(`enc:v2:${keyId(OLD_KEY)}:`)).toBe(true);
    expect(() => decrypt(raw!.name, createKeyring(NEW_KEY))).toThrow();

    const rotated = await rotate();
    const read = await rotated.prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(read.name).toBe('Ana');
  });

  it('writes under the current key', async () => {
    const patient = await createTestPatient(userId, { name: 'Ana' });
    const rotated = await rotate();
    await rotated.prisma.patient.update({ where: { id: patient.id }, data: { notes: 'nueva nota' } });

    const [ row ] = await prisma.$queryRaw<{ notes: string }[]>`
      SELECT "notes" FROM patients WHERE id = ${patient.id}::uuid`;
    expect(decrypt(row!.notes, createKeyring(NEW_KEY))).toBe('nueva nota');

    const mixed = await rotated.prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(mixed.name).toBe('Ana');
  });

  it('backfill reads ciphertext under the previous key', async () => {
    const patient = await createTestPatient(userId, { name: 'Ana' });
    await prisma.$executeRaw`UPDATE patients SET "piiVersion" = 1 WHERE id = ${patient.id}::uuid`;
    const before = await prisma.$queryRaw<{ nameTokens: string[] }[]>`
      SELECT "nameTokens" FROM patients WHERE id = ${patient.id}::uuid`;

    const rotated = await rotate();
    const { backfillPii } = await import('../../../src/utils/prisma/backfill-pii.js');
    await backfillPii();

    const [ after ] = await rotated.prisma.$queryRaw<{ piiVersion: number; nameTokens: string[] }[]>`
      SELECT "piiVersion", "nameTokens" FROM patients WHERE id = ${patient.id}::uuid`;
    expect(after!.piiVersion).toBe(PII_VERSION);
    expect(after!.nameTokens).toEqual(before[ 0 ]!.nameTokens);
  });

  it('fails loudly on a key id outside the ring', async () => {
    const patient = await createTestPatient(userId, { name: 'Ana' });
    await prisma.$executeRaw`UPDATE patients SET "name" = ${sealV2('x', 'd'.repeat(64))} WHERE id = ${patient.id}::uuid`;
    await expect(prisma.patient.findUniqueOrThrow({ where: { id: patient.id } }))
      .rejects.toThrow(/Failed to decrypt Patient\.name: Unknown encryption key id/);
  });
});
