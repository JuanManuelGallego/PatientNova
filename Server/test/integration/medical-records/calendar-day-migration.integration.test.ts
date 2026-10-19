import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { createTestUser, createTestPatient } from '../helpers.js';

// The migration is already applied to the test DB; re-run its statements against legacy rows.
const migrationSql = readFileSync(
  fileURLToPath(new URL('../../../migrations/20261018000000_calendar_day_utc_midnight/migration.sql', import.meta.url)),
  'utf8',
);

async function runMigration() {
  const statements = migrationSql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await prisma.$executeRawUnsafe(statement);
}

async function recordFor(timezone: string, birthDate: string, noteDates: string[]) {
  const user = await createTestUser();
  await prisma.user.update({ where: { id: user.id }, data: { timezone } });
  const patient = await createTestPatient(user.id);
  return prisma.medicalRecord.create({
    data: {
      patientId: patient.id,
      birthDate: new Date(birthDate),
      evolutionNotes: { create: noteDates.map((date) => ({ date: new Date(date) })) },
    },
  });
}

async function storedDays(id: string) {
  const record = await prisma.medicalRecord.findUniqueOrThrow({
    where: { id },
    include: { evolutionNotes: { orderBy: { date: 'asc' } } },
  });
  return {
    birthDate: record.birthDate?.toISOString(),
    notes: record.evolutionNotes.map((n) => n.date.toISOString()),
  };
}

describe('20261018000000_calendar_day_utc_midnight (integration)', () => {
  it('moves local midnights and save times to UTC midnight of the provider-zone day', async () => {
    // Bogotá (UTC-5): local midnight of 1990-05-01, and notes saved at 19:00 / 08:00 local.
    const bogota = await recordFor('America/Bogota', '1990-05-01T05:00:00.000Z', [
      '2026-03-10T00:00:00.500Z',
      '2026-03-11T13:00:00.000Z',
    ]);
    // Madrid (UTC+2 in May): local midnight of 1990-05-01 is the previous UTC day.
    const madrid = await recordFor('Europe/Madrid', '1990-04-30T22:00:00.000Z', []);

    await runMigration();

    expect(await storedDays(bogota.id)).toEqual({
      birthDate: '1990-05-01T00:00:00.000Z',
      notes: [ '2026-03-09T00:00:00.000Z', '2026-03-11T00:00:00.000Z' ],
    });
    expect((await storedDays(madrid.id)).birthDate).toBe('1990-05-01T00:00:00.000Z');
  });

  it('leaves values already at UTC midnight unchanged and is idempotent', async () => {
    const record = await recordFor('America/Bogota', '1990-05-01T00:00:00.000Z', [ '2026-03-10T00:00:00.000Z' ]);

    await runMigration();
    await runMigration();

    expect(await storedDays(record.id)).toEqual({
      birthDate: '1990-05-01T00:00:00.000Z',
      notes: [ '2026-03-10T00:00:00.000Z' ],
    });
  });
});
