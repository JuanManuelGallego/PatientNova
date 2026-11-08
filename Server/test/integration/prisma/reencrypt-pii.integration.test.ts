import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { createKeyring, decrypt, keyId } from '../../../src/utils/encryption/field-encryption.js';
import { ENCRYPTED_FIELDS, ENCRYPTED_JSON_FIELDS } from '../../../src/utils/encryption/encrypted-fields.js';
import { ERASED_TEXT } from '../../../src/patients/patient-erasure.service.js';
import {
  ActionSource,
  ActionType,
  Channel,
  EntityType,
  PatientStatus,
  ReminderMode,
} from '../../../generated/prisma/client.ts';
import { sealV1, sealV2 } from '../../ciphertext-fixtures.js';
import {
  appointmentTimeRange,
  createTestAppointmentType,
  createTestLocation,
  createTestPatient,
  createTestUser,
  futureDate,
  unique,
} from '../helpers.js';
import { useKeys } from './use-keys.js';

const OLD_KEY = process.env.ENCRYPTION_KEY ?? '';
if (!OLD_KEY.trim()) throw new Error('ENCRYPTION_KEY must be set for re-encrypt tests (see .env.test)');
const NEW_KEY = 'c'.repeat(64);
const STRANGER_KEY = 'd'.repeat(64);
const NEW_RING = createKeyring(NEW_KEY);
const NEW_ID = keyId(NEW_KEY);
const NEW_PREFIX = `enc:v2:${NEW_ID}:`;
const OLD_PREFIX = `enc:v2:${keyId(OLD_KEY)}:`;

type Row = Record<string, unknown>;
/** model -> record id -> field -> plaintext as stored before encryption (JSON fields: their JSON text). */
type Expected = Record<string, Record<string, Record<string, string>>>;

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (closers.length > 0) await closers.pop()!();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function rotate() {
  const rotated = await useKeys({ current: NEW_KEY, previous: OLD_KEY });
  closers.push(rotated.close);
  const mod = await import('../../../src/utils/prisma/reencrypt-pii.js');
  return { ...rotated, ...mod };
}

const isJson = (model: string, field: string) => ENCRYPTED_JSON_FIELDS[ model ]?.has(field) ?? false;
const fieldsOf = (model: string) => [ ...ENCRYPTED_FIELDS[ model ]! ];
const textOf = (model: string, field: string) => (isJson(model, field) ? `("${field}" #>> '{}')` : `"${field}"`);

/** Every encrypted field of every row of a table, as text (JSON fields unwrapped), keyed by id. */
async function readCiphertext(model: string, table: string): Promise<Map<string, Row>> {
  const columns = fieldsOf(model).map((f) => `${textOf(model, f)} AS "${f}"`).join(', ');
  const rows = await prisma.$queryRawUnsafe<Row[]>(`SELECT "id"::text AS "id", ${columns} FROM "${table}" ORDER BY "id"`);
  return new Map(rows.map((row) => [ row.id as string, row ]));
}

async function selectAll(table: string): Promise<Row[]> {
  return prisma.$queryRawUnsafe<Row[]>(`SELECT * FROM "${table}" ORDER BY "id"`);
}

function withoutEncrypted(model: string, rows: Row[]): Row[] {
  const fields = ENCRYPTED_FIELDS[ model ]!;
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([ key ]) => !fields.has(key))));
}

function track(expected: Expected, model: string, id: string, values: Row) {
  const plain: Record<string, string> = {};
  for (const field of fieldsOf(model)) {
    const value = values[ field ];
    if (value === undefined || value === null) throw new Error(`seed must set ${model}.${field}`);
    plain[ field ] = isJson(model, field) ? JSON.stringify(value) : String(value);
  }
  (expected[ model ] ??= {})[ id ] = plain;
}

/** One row per model with every encrypted field set, written under OLD_KEY through the suite's client. */
async function seedEveryModel() {
  const expected: Expected = {};
  const user = await createTestUser();
  const userPii = { bankName: 'Banco Uno', accountNumber: '0011223344', nationalId: '1020304050', bankingKey: 'llave-123' };
  await prisma.user.update({ where: { id: user.id }, data: userPii });
  track(expected, 'User', user.id, userPii);

  const seedPatient = async (label: string, extra: { status?: PatientStatus; isDeleted?: boolean } = {}) => {
    const pii = {
      name: `Ana ${label}`,
      lastName: 'Pérez',
      email: unique(`${label}@test.local`).toLowerCase(),
      whatsappNumber: '+573001112233',
      smsNumber: '+573001112244',
      notes: `nota ${label}`,
    };
    const patient = await prisma.patient.create({
      data: {
        ...pii,
        userId: user.id,
        status: extra.status ?? PatientStatus.ACTIVE,
        isDeleted: extra.isDeleted ?? false,
        deletedAt: extra.isDeleted ? new Date() : null,
      },
    });
    track(expected, 'Patient', patient.id, pii);
    return patient;
  };
  const patient = await seedPatient('activa');
  const inactive = await seedPatient('inactiva', { status: PatientStatus.INACTIVE });
  const deleted = await seedPatient('borrada', { isDeleted: true });

  const recordPii = Object.fromEntries(fieldsOf('MedicalRecord').map((f) => [ f, `historia ${f}` ]));
  const record = await prisma.medicalRecord.create({ data: { ...recordPii, patientId: patient.id } });
  track(expected, 'MedicalRecord', record.id, recordPii);

  const memberPii = { name: 'Luis', relation: 'hermano' };
  const member = await prisma.familyMember.create({ data: { ...memberPii, medicalRecordId: record.id } });
  track(expected, 'FamilyMember', member.id, memberPii);

  const notePii = { text: 'evolución favorable' };
  const note = await prisma.evolutionNote.create({
    data: { ...notePii, date: new Date('2026-01-01T00:00:00Z'), medicalRecordId: record.id },
  });
  track(expected, 'EvolutionNote', note.id, notePii);

  const { start, end } = appointmentTimeRange(24 * 60);
  const appointmentPii = { notes: 'nota de cita' };
  const appointment = await prisma.appointment.create({
    data: { ...appointmentPii, startAt: start, endAt: end, price: 100, patientId: patient.id, userId: user.id },
  });
  track(expected, 'Appointment', appointment.id, appointmentPii);

  const reminderPii = { to: 'ana@test.local', subject: 'Recordatorio', body: 'Su cita es mañana' };
  const reminder = await prisma.reminder.create({
    data: {
      ...reminderPii,
      channel: Channel.EMAIL,
      sendMode: ReminderMode.SCHEDULED,
      sendAt: futureDate(60),
      appointmentId: appointment.id,
      patientId: patient.id,
      userId: user.id,
    },
  });
  track(expected, 'Reminder', reminder.id, reminderPii);

  const auditPii = {
    actorDisplayName: 'Dra. Ana',
    description: 'Actualizó la nota',
    ipAddress: '203.0.113.7',
    fieldsBefore: { notes: 'antes', count: 1 },
    fieldsAfter: { notes: 'después', tags: [ 'a', 'b' ] },
  };
  const audit = await prisma.auditLog.create({
    data: {
      ...auditPii,
      userId: user.id,
      actorId: user.id,
      entityType: EntityType.PATIENT,
      entityId: patient.id,
      actionType: ActionType.UPDATE,
      source: ActionSource.API,
      affectedFields: [ 'notes' ],
    },
  });
  track(expected, 'AuditLog', audit.id, auditPii);

  const googlePii = { refreshToken: 'refresh-token-secreto' };
  const google = await prisma.googleConnection.create({ data: { ...googlePii, userId: user.id, grantedScopes: [] } });
  track(expected, 'GoogleConnection', google.id, googlePii);

  const type = await createTestAppointmentType(user.id);
  const location = await createTestLocation(user.id);
  const slot = appointmentTimeRange(3 * 24 * 60);
  const requestPii = {
    email: 'solicitud@test.local',
    verifiedPhone: '+573001112255',
    name: 'Rosa',
    lastName: 'Gómez',
    phone: '+573001112266',
  };
  const request = await prisma.bookingRequest.create({
    data: {
      ...requestPii,
      userId: user.id,
      typeId: type.id,
      locationId: location.id,
      startAt: slot.start,
      endAt: slot.end,
      patientTimezone: 'America/Bogota',
      holdExpiresAt: futureDate(24 * 60),
      policyVersion: '2026-11',
      consentAcceptedAt: new Date(),
    },
  });
  track(expected, 'BookingRequest', request.id, requestPii);

  // v1 values: one under the old key, one already under the new key (it must move to v2 too).
  await prisma.$executeRaw`UPDATE patients SET "notes" = ${sealV1('nota v1 vieja', OLD_KEY)} WHERE id = ${patient.id}::uuid`;
  expected.Patient![ patient.id ]!.notes = 'nota v1 vieja';
  await prisma.$executeRaw`UPDATE appointments SET "notes" = ${sealV1('nota v1 nueva', NEW_KEY)} WHERE id = ${appointment.id}::uuid`;
  expected.Appointment![ appointment.id ]!.notes = 'nota v1 nueva';

  return { expected, user, patient, inactive, deleted, audit, auditPii };
}

describe('pii:reencrypt', () => {
  it('covers every encrypted model', async () => {
    const { REENCRYPT_TABLES } = await rotate();
    expect(Object.keys(REENCRYPT_TABLES).sort()).toEqual(Object.keys(ENCRYPTED_FIELDS).sort());
  });

  it('every encrypted column has no length limit', async () => {
    const { REENCRYPT_TABLES } = await rotate();
    for (const [ model, { table } ] of Object.entries(REENCRYPT_TABLES)) {
      const columns = await prisma.$queryRaw<{ column_name: string; data_type: string; character_maximum_length: number | null }[]>`
        SELECT column_name, data_type, character_maximum_length FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}`;
      const byName = new Map(columns.map((c) => [ c.column_name, c ]));
      for (const field of fieldsOf(model)) {
        const column = byName.get(field);
        expect(column, `${model}.${field}`).toBeDefined();
        expect([ 'text', 'jsonb' ], `${model}.${field}`).toContain(column!.data_type);
        expect(column!.data_type === 'jsonb', `${model}.${field}`).toBe(isJson(model, field));
        expect(column!.character_maximum_length, `${model}.${field}`).toBeNull();
      }
    }
  });

  it('moves every field of every model to the current key', async () => {
    const { expected } = await seedEveryModel();
    const { reencryptPii, REENCRYPT_TABLES } = await rotate();

    const results = await reencryptPii({ batchSize: 1, keyId: NEW_ID });
    expect(results.every((r) => r.failed === 0 && r.skipped === 0)).toBe(true);
    expect(results.map((r) => r.model).sort()).toEqual(Object.keys(ENCRYPTED_FIELDS).sort());
    for (const result of results) {
      const seeded = Object.keys(expected[ result.model ] ?? {}).length;
      expect(result.updated, result.model).toBe(seeded);
      expect(result.scanned, result.model).toBe(seeded);
    }

    for (const [ model, { table } ] of Object.entries(REENCRYPT_TABLES)) {
      const rows = await readCiphertext(model, table);
      for (const [ id, plain ] of Object.entries(expected[ model ] ?? {})) {
        const row = rows.get(id);
        expect(row, `${model} ${id}`).toBeDefined();
        for (const [ field, value ] of Object.entries(plain)) {
          const stored = row![ field ] as string;
          expect(stored.startsWith(NEW_PREFIX), `${model}.${field}`).toBe(true);
          expect(decrypt(stored, NEW_RING), `${model}.${field}`).toBe(value);
        }
      }
      for (const row of rows.values()) {
        for (const field of fieldsOf(model)) {
          const stored = row[ field ];
          if (typeof stored === 'string') expect(stored.startsWith(NEW_PREFIX), `${model}.${field}`).toBe(true);
        }
      }
    }

    const again = await reencryptPii({ keyId: NEW_ID });
    expect(again.every((r) => r.scanned === 0 && r.updated === 0)).toBe(true);
  });

  it('leaves nothing that needs the old key', async () => {
    const { expected, deleted, audit, auditPii } = await seedEveryModel();
    const { reencryptPii } = await rotate();
    await reencryptPii({ keyId: NEW_ID });
    await closers.pop()!();

    const after = await useKeys({ current: NEW_KEY }); // no previous key in the ring
    closers.push(after.close);

    const readDeleted = await after.prisma.patient.findUniqueOrThrow({ where: { id: deleted.id } });
    expect(readDeleted.isDeleted).toBe(true);
    expect(readDeleted.name).toBe(expected.Patient![ deleted.id ]!.name);
    expect(readDeleted.notes).toBe(expected.Patient![ deleted.id ]!.notes);

    const readAudit = await after.prisma.auditLog.findUniqueOrThrow({ where: { id: audit.id } });
    expect(readAudit.actorDisplayName).toBe(auditPii.actorDisplayName);
    expect(readAudit.description).toBe(auditPii.description);
    expect(readAudit.ipAddress).toBe(auditPii.ipAddress);
    expect(readAudit.fieldsBefore).toEqual(auditPii.fieldsBefore);
    expect(readAudit.fieldsAfter).toEqual(auditPii.fieldsAfter);

    // And every seeded row of every model reads back under the new key alone.
    const delegates = after.prisma as unknown as Record<string, { findMany(): Promise<Row[]> }>;
    for (const [ model, records ] of Object.entries(expected)) {
      const rows = await delegates[ model[ 0 ]!.toLowerCase() + model.slice(1) ]!.findMany();
      const byId = new Map(rows.map((row) => [ row.id as string, row ]));
      for (const [ id, plain ] of Object.entries(records)) {
        for (const [ field, value ] of Object.entries(plain)) {
          const read = byId.get(id)![ field ];
          expect(isJson(model, field) ? JSON.stringify(read) : read, `${model}.${field}`).toBe(value);
        }
      }
    }
  });

  it('changes only ciphertext: updatedAt and every other column are kept', async () => {
    await seedEveryModel();
    const patientsBefore = await selectAll('patients');
    const auditBefore = await selectAll('AuditLog');

    const { reencryptPii } = await rotate();
    const results = await reencryptPii({ keyId: NEW_ID });
    expect(results.find((r) => r.model === 'Patient')!.updated).toBe(3);

    const patientsAfter = await selectAll('patients');
    const auditAfter = await selectAll('AuditLog');
    expect(withoutEncrypted('Patient', patientsAfter)).toEqual(withoutEncrypted('Patient', patientsBefore));
    expect(withoutEncrypted('AuditLog', auditAfter)).toEqual(withoutEncrypted('AuditLog', auditBefore));
    // The ciphertext itself did change.
    expect(patientsAfter.map((p) => p.name)).not.toEqual(patientsBefore.map((p) => p.name));
    expect(auditAfter.map((a) => a.description)).not.toEqual(auditBefore.map((a) => a.description));
  });

  it('rewrites audit JSON ciphertext and leaves plain JSON alone', async () => {
    const user = await createTestUser();
    const fieldsBefore = { notes: 'antes', nested: { list: [ 1, 2 ] } };
    const encrypted = await prisma.auditLog.create({
      data: {
        userId: user.id,
        actorId: user.id,
        actorDisplayName: 'Dra. Ana',
        entityType: EntityType.PATIENT,
        entityId: 'p1',
        actionType: ActionType.UPDATE,
        source: ActionSource.API,
        description: 'Actualizó',
        affectedFields: [ 'notes' ],
        fieldsBefore,
      },
    });
    const insertPlain = (id: string, json: string) => prisma.$executeRawUnsafe(
      `INSERT INTO "AuditLog" ("id", "userId", "actorId", "actorDisplayName", "entityType", "entityId", "actionType",
         "source", "description", "affectedFields", "fieldsBefore")
       VALUES ($1, $2, $2, 'Sistema', 'PATIENT', 'p1', 'UPDATE', 'API', 'texto plano', '{}', $3::jsonb)`,
      id, user.id, json,
    );
    const plainId = unique('audit-plain');
    const nullId = unique('audit-null');
    await insertPlain(plainId, '{"notes": "sin cifrar"}');
    await insertPlain(nullId, 'null');
    const untouched = `SELECT to_jsonb(a)::text AS "row" FROM "AuditLog" a WHERE "id" = ANY($1::text[]) ORDER BY "id"`;
    const before = await prisma.$queryRawUnsafe<{ row: string }[]>(untouched, [ plainId, nullId ]);

    const rotated = await rotate();
    const audit = (await rotated.reencryptPii({ keyId: NEW_ID })).find((r) => r.model === 'AuditLog')!;
    expect(audit).toMatchObject({ scanned: 1, updated: 1, skipped: 0, failed: 0 });

    const [ first ] = await prisma.$queryRaw<{ kind: string; text: string }[]>`
      SELECT jsonb_typeof("fieldsBefore") AS "kind", ("fieldsBefore" #>> '{}') AS "text"
      FROM "AuditLog" WHERE "id" = ${encrypted.id}`;
    expect(first!.kind).toBe('string');
    expect(first!.text.startsWith(NEW_PREFIX)).toBe(true);
    expect(JSON.parse(decrypt(first!.text, NEW_RING))).toEqual(fieldsBefore);

    expect(await prisma.$queryRawUnsafe(untouched, [ plainId, nullId ])).toEqual(before);
    const read = await rotated.prisma.auditLog.findUniqueOrThrow({ where: { id: encrypted.id } });
    expect(read.fieldsBefore).toEqual(fieldsBefore);
    await expect(rotated.prisma.auditLog.update({ where: { id: encrypted.id }, data: {} })).rejects.toThrow('AuditLog is immutable');
  });

  it('skips a row the app changed after it was read', async () => {
    const user = await createTestUser();
    const patient = await createTestPatient(user.id, { name: 'Ana' });
    await prisma.patient.update({ where: { id: patient.id }, data: { notes: 'nota original' } });
    const [ snapshot ] = await prisma.$queryRaw<Row[]>`
      SELECT "id"::text AS "id", "name", "lastName", "email", "whatsappNumber", "smsNumber", "notes"
      FROM patients WHERE id = ${patient.id}::uuid`;
    expect((snapshot!.notes as string).startsWith(OLD_PREFIX)).toBe(true);

    const rotated = await rotate();
    await rotated.prisma.patient.update({ where: { id: patient.id }, data: { notes: 'nota de la app' } });
    const { activeKeyring } = await import('../../../src/utils/encryption/keyring.js');

    const outcome = await rotated.reencryptRow('Patient', snapshot!, activeKeyring()!);
    expect(outcome).toEqual({ outcome: 'skipped', failedFields: [] });

    const [ row ] = await prisma.$queryRaw<{ name: string; notes: string }[]>`
      SELECT "name", "notes" FROM patients WHERE id = ${patient.id}::uuid`;
    expect(decrypt(row!.notes, NEW_RING)).toBe('nota de la app');
    expect(row!.name).toBe(snapshot!.name); // nothing in the row was rewritten
  });

  it('counts a value no key opens, keeps it and still moves the rest of the row', async () => {
    const user = await createTestUser();
    const stuck = await createTestPatient(user.id, { name: 'Ana', lastName: 'Pérez', email: 'ana-stuck@test.local' });
    const moving = await createTestPatient(user.id, { name: 'Bea' });
    const foreign = sealV2('x', STRANGER_KEY);
    await prisma.$executeRaw`UPDATE patients SET "name" = ${foreign} WHERE id = ${stuck.id}::uuid`;
    const [ stuckBefore ] = await prisma.$queryRaw<Row[]>`SELECT * FROM patients WHERE id = ${stuck.id}::uuid`;
    expect((stuckBefore!.lastName as string).startsWith(OLD_PREFIX)).toBe(true);

    const rotated = await rotate();
    const { logger } = await import('../../../src/utils/api/logger.js');
    const errorLog = vi.spyOn(logger, 'error');

    const patient = (await rotated.reencryptPii({ keyId: NEW_ID })).find((r) => r.model === 'Patient')!;
    expect(patient).toMatchObject({ scanned: 2, updated: 1, skipped: 0, failed: 1 });
    expect(patient.failures).toEqual([ { field: 'name', recordId: stuck.id } ]);

    const [ stuckAfter ] = await prisma.$queryRaw<Row[]>`SELECT * FROM patients WHERE id = ${stuck.id}::uuid`;
    expect(stuckAfter!.name).toBe(foreign); // byte for byte
    for (const field of [ 'lastName', 'email' ]) {
      expect((stuckAfter![ field ] as string).startsWith(NEW_PREFIX), field).toBe(true);
    }
    expect(decrypt(stuckAfter!.lastName as string, NEW_RING)).toBe('Pérez');
    expect(decrypt(stuckAfter!.email as string, NEW_RING)).toBe('ana-stuck@test.local');
    expect(withoutEncrypted('Patient', [ stuckAfter! ])).toEqual(withoutEncrypted('Patient', [ stuckBefore! ]));

    const [ moved ] = await prisma.$queryRaw<{ name: string; lastName: string; email: string }[]>`
      SELECT "name", "lastName", "email" FROM patients WHERE id = ${moving.id}::uuid`;
    for (const value of Object.values(moved!)) expect(value.startsWith(NEW_PREFIX)).toBe(true);
    expect(decrypt(moved!.name, NEW_RING)).toBe('Bea');

    expect(errorLog).toHaveBeenCalledWith({ model: 'Patient', field: 'name', recordId: stuck.id }, expect.any(String));
    for (const call of errorLog.mock.calls) {
      const logged = JSON.stringify(call);
      expect(logged).not.toContain('enc:');
      expect(logged).not.toContain(STRANGER_KEY);
    }

    // A rerun scans only the failed row, and finds only its unopenable value.
    const again = (await rotated.reencryptPii({ keyId: NEW_ID })).find((r) => r.model === 'Patient')!;
    expect(again).toMatchObject({ scanned: 1, updated: 0, skipped: 0, failed: 1 });
    expect(again.failures).toEqual([ { field: 'name', recordId: stuck.id } ]);
  });

  it('reports every value no key opens in a row, not just the first', async () => {
    const user = await createTestUser();
    const stuck = await createTestPatient(user.id, { name: 'Ana', lastName: 'Pérez' });
    const lookAlike = 'enc:v2:0123abcd:Ana María'; // typed by someone: no key can open it
    const foreign = sealV1('nota', STRANGER_KEY);
    await prisma.$executeRaw`
      UPDATE patients SET "name" = ${lookAlike}, "notes" = ${foreign} WHERE id = ${stuck.id}::uuid`;

    const rotated = await rotate();
    const { logger } = await import('../../../src/utils/api/logger.js');
    const errorLog = vi.spyOn(logger, 'error');

    const patient = (await rotated.reencryptPii({ keyId: NEW_ID })).find((r) => r.model === 'Patient')!;
    expect(patient).toMatchObject({ scanned: 1, updated: 0, skipped: 0, failed: 1 });
    expect(patient.failures).toEqual([
      { field: 'name', recordId: stuck.id },
      { field: 'notes', recordId: stuck.id },
    ]);
    expect(errorLog).toHaveBeenCalledWith({ model: 'Patient', field: 'name', recordId: stuck.id }, expect.any(String));
    expect(errorLog).toHaveBeenCalledWith({ model: 'Patient', field: 'notes', recordId: stuck.id }, expect.any(String));

    const [ after ] = await prisma.$queryRaw<{ name: string; lastName: string; notes: string }[]>`
      SELECT "name", "lastName", "notes" FROM patients WHERE id = ${stuck.id}::uuid`;
    expect(after!.name).toBe(lookAlike);
    expect(after!.notes).toBe(foreign);
    expect(after!.lastName.startsWith(NEW_PREFIX)).toBe(true);
    expect(decrypt(after!.lastName, NEW_RING)).toBe('Pérez');
  });

  it('a dry run writes nothing and reports what a real run scans', async () => {
    const { expected, patient } = await seedEveryModel();
    await prisma.$executeRaw`UPDATE patients SET "smsNumber" = ${sealV2('x', STRANGER_KEY)} WHERE id = ${patient.id}::uuid`;
    const { reencryptPii, REENCRYPT_TABLES } = await rotate();
    const { logger } = await import('../../../src/utils/api/logger.js');
    const errorLog = vi.spyOn(logger, 'error');
    const snapshot = async () => {
      const all: Record<string, Row[]> = {};
      for (const [ model, { table } ] of Object.entries(REENCRYPT_TABLES)) all[ model ] = await selectAll(table);
      return all;
    };
    const before = await snapshot();

    const report = await reencryptPii({ dryRun: true, batchSize: 1 });
    expect(await snapshot()).toEqual(before);
    expect(errorLog).not.toHaveBeenCalled();
    for (const r of report) {
      expect(r.scanned, r.model).toBe(Object.keys(expected[ r.model ] ?? {}).length);
      expect(r.updated, r.model).toBe(0);
      expect(r.skipped, r.model).toBe(0);
    }
    const reportedPatient = report.find((r) => r.model === 'Patient')!;
    expect(reportedPatient.failed).toBe(1);
    expect(reportedPatient.failures).toEqual([ { field: 'smsNumber', recordId: patient.id } ]);
    expect(report.filter((r) => r.model !== 'Patient').every((r) => r.failed === 0)).toBe(true);

    const written = await reencryptPii({ keyId: NEW_ID });
    expect(written.map((r) => [ r.model, r.scanned, r.failed ])).toEqual(report.map((r) => [ r.model, r.scanned, r.failed ]));
    expect(written.find((r) => r.model === 'Patient')!.failures).toEqual(reportedPatient.failures);
  });

  it('writes only when given the current key id', async () => {
    const user = await createTestUser();
    const patient = await createTestPatient(user.id, { name: 'Ana' });
    const read = () => prisma.$queryRaw<Row[]>`SELECT * FROM patients WHERE id = ${patient.id}::uuid`;
    const before = await read();
    const { reencryptPii, confirmKeyId } = await rotate();
    const oldId = keyId(OLD_KEY);

    await expect(reencryptPii()).rejects.toThrow('nothing was written');
    await expect(reencryptPii({ keyId: oldId })).rejects.toThrow(
      `--key-id ${oldId} does not match the current key id ${NEW_ID}; nothing was written`,
    );
    // A key pasted in place of its id is refused without being echoed.
    const pasted = await reencryptPii({ keyId: NEW_KEY }).catch((error: unknown) => error);
    expect(pasted).toBeInstanceOf(Error);
    expect((pasted as Error).name).toBe('KeyIdMismatchError');
    expect((pasted as Error).message).not.toContain(NEW_KEY);
    expect(await read()).toEqual(before);

    expect(() => confirmKeyId(` ${NEW_ID.toUpperCase()} `, NEW_RING)).not.toThrow();
    expect(() => confirmKeyId(oldId, NEW_RING)).toThrow(oldId);
    expect(() => confirmKeyId(undefined, NEW_RING)).toThrow('--key-id must be');

    const patients = (await reencryptPii({ keyId: NEW_ID })).find((r) => r.model === 'Patient')!;
    expect(patients).toMatchObject({ scanned: 1, updated: 1, failed: 0 });
  });

  it('leaves plaintext and redacted audit rows alone', async () => {
    const user = await createTestUser();
    const patient = await createTestPatient(user.id);
    await prisma.$executeRaw`
      UPDATE patients SET "name" = 'Ana', "lastName" = 'Pérez', "email" = NULL,
        "notes" = 'enc:v2:nota escrita a mano, sin cifrar'
      WHERE id = ${patient.id}::uuid`;
    const audit = await prisma.auditLog.create({
      data: {
        userId: user.id,
        actorId: 'portal-actor',
        actorDisplayName: 'Paciente',
        entityType: EntityType.PATIENT,
        entityId: patient.id,
        actionType: ActionType.UPDATE,
        source: ActionSource.PUBLIC_PORTAL,
        description: 'Reservó una cita',
        affectedFields: [ 'notes' ],
        fieldsBefore: { notes: 'antes' },
        fieldsAfter: { notes: 'después' },
        ipAddress: '203.0.113.7',
        portalPatientId: patient.id,
      },
    });
    // The redaction patient:erase applies (patient-erasure.service.ts redactAuditRows).
    await prisma.$executeRaw`
      UPDATE "AuditLog"
      SET "description" = ${ERASED_TEXT}, "fieldsBefore" = NULL, "fieldsAfter" = NULL, "ipAddress" = NULL
      WHERE "id" = ${audit.id}`;
    await prisma.$executeRaw`
      UPDATE "AuditLog"
      SET "actorId" = 'suprimido', "actorDisplayName" = ${ERASED_TEXT}, "portalPatientId" = NULL
      WHERE "id" = ${audit.id} AND "source" = 'PUBLIC_PORTAL'`;

    const snapshot = async () => prisma.$queryRaw<{ patient: string; audit: string }[]>`
      SELECT (SELECT to_jsonb(p)::text FROM patients p WHERE p.id = ${patient.id}::uuid) AS "patient",
             (SELECT to_jsonb(a)::text FROM "AuditLog" a WHERE a.id = ${audit.id}) AS "audit"`;
    const before = await snapshot();

    const { reencryptPii } = await rotate();
    const results = await reencryptPii({ keyId: NEW_ID });
    expect(results.find((r) => r.model === 'Patient')).toMatchObject({ scanned: 0, updated: 0 });
    expect(results.find((r) => r.model === 'AuditLog')).toMatchObject({ scanned: 0, updated: 0 });

    expect(await snapshot()).toEqual(before);
  });

  it('moves the ciphertext of a redacted audit row and keeps its plaintext', async () => {
    const user = await createTestUser();
    const audit = await prisma.auditLog.create({
      data: {
        userId: user.id,
        actorId: user.id,
        actorDisplayName: 'Dra. Ana',
        entityType: EntityType.PATIENT,
        entityId: 'p1',
        actionType: ActionType.UPDATE,
        source: ActionSource.API,
        description: 'Actualizó la nota',
        affectedFields: [ 'notes' ],
        fieldsBefore: { notes: 'antes' },
        fieldsAfter: { notes: 'después' },
        ipAddress: '203.0.113.7',
      },
    });
    // patient:erase's first redaction UPDATE; a non-portal row keeps its encrypted actorDisplayName.
    await prisma.$executeRaw`
      UPDATE "AuditLog"
      SET "description" = ${ERASED_TEXT}, "fieldsBefore" = NULL, "fieldsAfter" = NULL, "ipAddress" = NULL
      WHERE "id" = ${audit.id}`;
    const read = () => prisma.$queryRaw<Row[]>`
      SELECT "actorDisplayName", "description", "fieldsBefore", "fieldsAfter", "ipAddress"
      FROM "AuditLog" WHERE "id" = ${audit.id}`;
    const [ before ] = await read();
    expect((before!.actorDisplayName as string).startsWith(OLD_PREFIX)).toBe(true);

    const { reencryptPii } = await rotate();
    const results = await reencryptPii({ keyId: NEW_ID });
    expect(results.find((r) => r.model === 'AuditLog')).toMatchObject({ scanned: 1, updated: 1, skipped: 0, failed: 0 });

    const [ after ] = await read();
    const actor = after!.actorDisplayName as string;
    expect(actor.startsWith(NEW_PREFIX)).toBe(true);
    expect(decrypt(actor, NEW_RING)).toBe('Dra. Ana');
    expect(after!.description).toBe(ERASED_TEXT);
    expect(after!.fieldsBefore).toBeNull();
    expect(after!.fieldsAfter).toBeNull();
    expect(after!.ipAddress).toBeNull();
  });
});
