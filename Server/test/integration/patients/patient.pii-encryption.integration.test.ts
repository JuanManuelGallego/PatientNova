import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { patientRepository } from '../../../src/patients/patient.repository.js';
import { appointmentRepository } from '../../../src/appointments/appointment.repository.js';
import { reminderRepository } from '../../../src/reminders/reminder.repository.js';
import { medicalRecordRepository } from '../../../src/medical-records/medical-record.repository.js';
import { listPatientsSchema } from '../../../src/patients/patient.schemas.js';
import { listAppointmentsSchema } from '../../../src/appointments/appointment.schemas.js';
import { listRemindersSchema } from '../../../src/reminders/reminder.schemas.js';
import { listMedicalRecordsSchema } from '../../../src/medical-records/medical-record.schemas.js';
import { backfillPii } from '../../../src/utils/prisma/backfill-pii.js';
import { emailHash, nameTokens, phoneHash, PII_VERSION } from '../../../src/utils/encryption/blind-index.js';
import { Channel, PatientStatus, ReminderStatus, AppointmentStatus } from '../../../generated/prisma/client.ts';
import {
  appointmentTimeRange,
  createTestAppointmentType,
  createTestLocation,
  createTestUser,
  unique,
} from '../helpers.js';

let userId: string;

beforeEach(async () => {
  userId = (await createTestUser()).id;
});

const ENC = /^enc:v1:/;

async function newPatient(overrides: Partial<{ name: string; lastName: string; email: string | null; whatsappNumber: string | null; smsNumber: string | null }> = {}) {
  return patientRepository.create(
    {
      name: overrides.name ?? 'María José',
      lastName: overrides.lastName ?? 'Pérez Gómez',
      email: overrides.email === undefined ? unique('maria@test.local') : overrides.email,
      whatsappNumber: overrides.whatsappNumber === undefined ? '+57 300 123 4567' : overrides.whatsappNumber,
      smsNumber: overrides.smsNumber ?? null,
      status: PatientStatus.ACTIVE,
    } as never,
    userId,
  );
}

const searchPatients = (search: string, extra: Record<string, unknown> = {}) =>
  patientRepository.findMany(listPatientsSchema.parse({ search, ...extra }), userId);

describe('patient PII at rest', () => {
  it('stores name, last name, email and phones as ciphertext with blind indexes, and reads them back in clear', async () => {
    const created = await newPatient({ email: 'Ana.Maria@Test.Local', smsNumber: '3001112222' });
    expect(created.name).toBe('María José');
    expect(created.email).toBe('ana.maria@test.local');

    const [ raw ] = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT "name", "lastName", "email", "whatsappNumber", "smsNumber", "emailHash", "whatsappHash",
             "smsHash", "nameTokens", "lastNameTokens", "piiVersion"
      FROM "patients" WHERE "id" = ${created.id}::uuid`;
    for (const field of [ 'name', 'lastName', 'email', 'whatsappNumber', 'smsNumber' ]) {
      expect(raw![ field ]).toMatch(ENC);
    }
    expect(JSON.stringify(raw)).not.toMatch(/mar[ií]a|p[eé]rez|test\.local|3001112222/i);
    expect(raw!.emailHash).toBe(emailHash('ana.maria@test.local'));
    expect(raw!.whatsappHash).toBe(phoneHash('573001234567'));
    expect(raw!.smsHash).toBe(phoneHash('3001112222'));
    expect(raw!.nameTokens).toEqual(nameTokens('maria jose'));
    expect(raw!.lastNameTokens).toEqual(nameTokens('perez gomez'));
    expect(raw!.piiVersion).toBe(PII_VERSION);

    const read = await patientRepository.findById(created.id, userId);
    expect(read).toMatchObject({ name: 'María José', lastName: 'Pérez Gómez', smsNumber: '3001112222' });
  });

  it('recomputes the indexes on update and clears them when a field is removed', async () => {
    const p = await newPatient();
    await patientRepository.update(p.id, { name: 'Lucía', email: null, whatsappNumber: null } as never, userId);

    const row = await prisma.patient.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.nameTokens).toEqual(nameTokens('lucia'));
    expect(row.emailHash).toBeNull();
    expect(row.whatsappHash).toBeNull();
    expect((await searchPatients('maria')).total).toBe(0);
    expect((await searchPatients('lucia perez')).total).toBe(1);
  });

  it('encrypts the reminder destination and subject, and the medical record name and birth place', async () => {
    const p = await newPatient();
    const reminder = await prisma.reminder.create({
      data: {
        channel: Channel.EMAIL, to: 'Ana@Test.Local', subject: 'Cita de María', sendMode: 'SCHEDULED',
        sendAt: new Date(Date.now() + 3_600_000), status: ReminderStatus.PENDING, patientId: p.id, userId,
      },
    });
    const record = await medicalRecordRepository.create({ patientId: p.id, name: 'María José Pérez', birthPlace: 'Medellín' } as never, userId);

    const [ r ] = await prisma.$queryRaw<Record<string, unknown>[]>`SELECT "to", "subject", "toHash" FROM "reminders" WHERE "id" = ${reminder.id}::uuid`;
    expect(r!.to).toMatch(ENC);
    expect(r!.subject).toMatch(ENC);
    expect(r!.toHash).toBe(emailHash('ana@test.local'));

    const [ m ] = await prisma.$queryRaw<Record<string, unknown>[]>`SELECT "name", "birthPlace", "nameTokens" FROM "medical_records" WHERE "id" = ${record.id}::uuid`;
    expect(m!.name).toMatch(ENC);
    expect(m!.birthPlace).toMatch(ENC);
    expect(m!.nameTokens).toEqual(nameTokens('maria jose perez'));
  });
});

describe('search over encrypted PII', () => {
  it('matches whole words of the name, ignoring case and accents, requiring every word', async () => {
    const maria = await newPatient();
    await newPatient({ name: 'Mario', lastName: 'Pérez', email: null, whatsappNumber: null });

    expect((await searchPatients('maria perez')).data.map((x) => x.id)).toEqual([ maria.id ]);
    expect((await searchPatients('  MARÍA   gómez ')).total).toBe(1);
    expect((await searchPatients('perez')).total).toBe(2);
    expect((await searchPatients('mar')).total).toBe(0); // partial words do not match
    expect((await searchPatients('maria lopez')).total).toBe(0);
  });

  it('matches an email exactly (case/whitespace-insensitive) and a phone ignoring punctuation', async () => {
    const p = await newPatient({ email: 'Exact@Test.Local', smsNumber: '+1 (555) 010-9999' });

    expect((await searchPatients(' exact@TEST.local ')).data[ 0 ]?.id).toBe(p.id);
    expect((await searchPatients('exact@test')).total).toBe(0);
    expect((await searchPatients('573001234567')).data[ 0 ]?.id).toBe(p.id);
    expect((await searchPatients('+1 555 010 9999')).data[ 0 ]?.id).toBe(p.id);
  });

  it('never matches another provider\'s patients', async () => {
    await newPatient({ email: 'shared@test.local' });
    const other = await createTestUser();
    const found = await patientRepository.findMany(listPatientsSchema.parse({ search: 'maria' }), other.id);
    expect(found.total).toBe(0);
    expect(await patientRepository.findByEmail('SHARED@test.local', other.id)).toBeNull();
    expect(await patientRepository.findByEmail('SHARED@test.local', userId)).not.toBeNull();
  });

  it('searches appointments, reminders and medical records by patient name or destination', async () => {
    const p = await newPatient({ email: 'dest@test.local' });
    const other = await newPatient({ name: 'Pedro', lastName: 'Ruiz', email: null, whatsappNumber: null });
    const loc = await createTestLocation(userId);
    const type = await createTestAppointmentType(userId);
    for (const [ patient, offset ] of [ [ p, 120 ], [ other, 240 ] ] as const) {
      const { start, end } = appointmentTimeRange(offset, 30);
      await appointmentRepository.create({
        startAt: start.toISOString(), endAt: end.toISOString(), price: 0, paid: false,
        status: AppointmentStatus.SCHEDULED, patientId: patient.id, locationId: loc.id, typeId: type.id,
      }, userId);
    }
    await prisma.reminder.create({
      data: {
        channel: Channel.EMAIL, to: 'dest@test.local', sendMode: 'SCHEDULED', sendAt: new Date(Date.now() + 3_600_000),
        status: ReminderStatus.PENDING, patientId: p.id, userId,
      },
    });
    await medicalRecordRepository.create({ patientId: p.id, name: 'María José Pérez' } as never, userId);

    const appts = await appointmentRepository.findMany(listAppointmentsSchema.parse({ search: 'pérez' }), userId);
    expect(appts.data.map((a) => a.patientId)).toEqual([ p.id ]);

    const byName = await reminderRepository.findMany(listRemindersSchema.parse({ search: 'maria' }), userId);
    const byDest = await reminderRepository.findMany(listRemindersSchema.parse({ search: 'DEST@test.local' }), userId);
    const none = await reminderRepository.findMany(listRemindersSchema.parse({ search: 'dest@' }), userId);
    expect([ byName.total, byDest.total, none.total ]).toEqual([ 1, 1, 0 ]);

    const records = await medicalRecordRepository.findMany(listMedicalRecordsSchema.parse({ search: 'jose' }), userId);
    expect(records.total).toBe(1);
  });
});

describe('sorting by encrypted fields', () => {
  it('sorts by name (then last name) after decryption, with stable pagination', async () => {
    for (const [ name, lastName ] of [ [ 'Zoe', 'A' ], [ 'álvaro', 'B' ], [ 'Beatriz', 'C' ], [ 'Álvaro', 'A' ] ]) {
      await newPatient({ name: name!, lastName: lastName!, email: null, whatsappNumber: null });
    }
    const page1 = await patientRepository.findMany(listPatientsSchema.parse({ orderBy: 'name', order: 'asc', pageSize: 3 }), userId);
    const page2 = await patientRepository.findMany(listPatientsSchema.parse({ orderBy: 'name', order: 'asc', pageSize: 3, page: 2 }), userId);
    expect(page1.total).toBe(4);
    expect([ ...page1.data, ...page2.data ].map((x) => `${x.name} ${x.lastName}`)).toEqual([ 'Álvaro A', 'álvaro B', 'Beatriz C', 'Zoe A' ]);

    const desc = await patientRepository.findMany(listPatientsSchema.parse({ orderBy: 'name', order: 'desc' }), userId);
    expect(desc.data[ 0 ]!.name).toBe('Zoe');
  });

  it('puts patients without email last when sorting by email', async () => {
    await newPatient({ email: null, whatsappNumber: null });
    await newPatient({ email: 'b@test.local' });
    await newPatient({ email: 'a@test.local' });
    const sorted = await patientRepository.findMany(listPatientsSchema.parse({ orderBy: 'email', order: 'asc' }), userId);
    expect(sorted.data.map((x) => x.email)).toEqual([ 'a@test.local', 'b@test.local', null ]);
  });
});

describe('pii backfill', () => {
  async function insertLegacyPatient(email: string) {
    const [ row ] = await prisma.$queryRaw<{ id: string; updatedAt: Date }[]>`
      INSERT INTO "patients" ("id", "name", "lastName", "email", "whatsappNumber", "status", "userId", "updatedAt")
      VALUES (gen_random_uuid(), 'Legacy Ñoño', 'Plain', ${email}, '+57 311 000 1111', 'ACTIVE', ${userId}, '2020-01-01T00:00:00Z')
      RETURNING "id"::text AS "id", "updatedAt"`;
    return row!;
  }

  it('encrypts legacy plaintext rows, writes their indexes, keeps updatedAt and is idempotent', async () => {
    const legacy = await insertLegacyPatient('legacy@test.local');
    await prisma.$executeRaw`
      INSERT INTO "reminders" ("id", "channel", "to", "sendMode", "sendAt", "status", "patientId", "userId", "updatedAt")
      VALUES (gen_random_uuid(), 'WHATSAPP', 'whatsapp:+573110001111', 'SCHEDULED', now(), 'SENT', ${legacy.id}::uuid, ${userId}, now())`;
    expect((await searchPatients('legacy')).total).toBe(0); // not searchable before the backfill

    const first = await backfillPii({ batchSize: 1 });
    expect(first.find((r) => r.model === 'Patient')!.updated).toBeGreaterThanOrEqual(1);

    const [ raw ] = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT "name", "email", "whatsappHash", "piiVersion", "updatedAt" FROM "patients" WHERE "id" = ${legacy.id}::uuid`;
    expect(raw!.name).toMatch(ENC);
    expect(raw!.email).toMatch(ENC);
    expect(raw!.whatsappHash).toBe(phoneHash('573110001111'));
    expect(raw!.piiVersion).toBe(PII_VERSION);
    expect(raw!.updatedAt).toEqual(legacy.updatedAt);

    expect((await searchPatients('ñoño plain')).total).toBe(1);
    expect((await patientRepository.findByEmail('LEGACY@test.local', userId))?.name).toBe('Legacy Ñoño');
    const [ rem ] = await prisma.$queryRaw<{ to: string; toHash: string }[]>`SELECT "to", "toHash" FROM "reminders" WHERE "patientId" = ${legacy.id}::uuid`;
    expect(rem!.to).toMatch(ENC);
    expect(rem!.toHash).toBe(raw!.whatsappHash); // the webhook can find the reminder by the patient's number

    const second = await backfillPii();
    expect(second.every((r) => r.scanned === 0 && r.updated === 0)).toBe(true);
  });

  it('enforces email uniqueness against backfilled rows', async () => {
    await insertLegacyPatient('dupe@test.local');
    await backfillPii();
    await expect(newPatient({ email: ' DUPE@test.local' })).rejects.toThrow();
  });
});
