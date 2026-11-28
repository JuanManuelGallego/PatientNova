import type { TransactionClient } from '../utils/prisma/prisma-client.js';
import { activeKeys, parseStoredTemplate, type RecordTemplate } from '../patient-types/record-template.js';
import { RecordDataCorruptError, RecordDataInvalidError } from './medical-record.errors.js';

export const CLINICAL_KEYS = [
  'consultationReason',
  'earlyDevelopment',
  'schoolAndWork',
  'lifestyleHabits',
  'traumaticEvents',
  'emotionalConsiderations',
  'physicalConsiderations',
  'mentalHistory',
  'objective',
  'familyObservations',
  'familyType',
  'lifecycle',
  'genogram',
  'resources',
  'difficulties',
  'communication',
  'rule',
  'limits',
  'familyContext',
  'expectations',
  'flexibility',
] as const;

export type ClinicalKey = (typeof CLINICAL_KEYS)[ number ];
export type RecordData = Record<string, string>;
export type ClinicalColumns = Partial<Record<ClinicalKey, string | null | undefined>>;

export const RECORD_DATA_MAX_LENGTH = 50_000;

export function parseRecordData(stored: string | null): RecordData {
  if (stored === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new RecordDataCorruptError();
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)
    || !Object.values(parsed).every((v) => typeof v === 'string')) {
    throw new RecordDataCorruptError();
  }
  return parsed as RecordData;
}

export function dataFromColumns(row: ClinicalColumns): RecordData {
  const data: RecordData = {};
  for (const key of CLINICAL_KEYS) {
    const value = row[ key ];
    if (typeof value === 'string' && value !== '') data[ key ] = value;
  }
  return data;
}

export function columnChanges(dto: ClinicalColumns): Record<string, string> {
  const changes: Record<string, string> = {};
  for (const key of CLINICAL_KEYS) {
    const value = dto[ key ];
    if (value !== undefined) changes[ key ] = value ?? '';
  }
  return changes;
}

export function applyDataChanges(current: RecordData, changes: Record<string, string>): RecordData {
  const next = { ...current };
  for (const [ key, value ] of Object.entries(changes)) {
    if (value === '') delete next[ key ];
    else next[ key ] = value;
  }
  return next;
}

export function checkDataChanges(template: RecordTemplate, changes: Record<string, unknown>): asserts changes is Record<string, string> {
  const allowed = activeKeys(template);
  for (const [ key, value ] of Object.entries(changes)) {
    if (!allowed.has(key) || typeof value !== 'string' || value.length > RECORD_DATA_MAX_LENGTH) {
      throw new RecordDataInvalidError();
    }
  }
}

/**
 * Serializes a patient's type change with the creation of their record: both read the patient's type and must see the
 * committed one. FOR UPDATE (not NO KEY UPDATE) so the record insert's foreign-key check waits too.
 */
export async function lockPatientType(tx: TransactionClient, patientId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "patients" WHERE "id" = ${patientId}::uuid FOR UPDATE`;
}

export async function lockRecord(tx: TransactionClient, recordId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "medical_records" WHERE "id" = ${recordId}::uuid FOR UPDATE`;
}

/** The template of the record's patient type, read on `tx`: call it after `lockRecord` so a type change can't slip in between. */
export async function templateOfRecord(tx: TransactionClient, recordId: string): Promise<RecordTemplate> {
  const row = await tx.medicalRecord.findUniqueOrThrow({
    where: { id: recordId },
    select: { patient: { select: { patientType: { select: { template: true } } } } },
  });
  return parseStoredTemplate(row.patient.patientType.template);
}

/** Locks the record, checks `changes` against its type's current template and merges them into the payload. */
export async function mergeRecordData(
  tx: TransactionClient,
  recordId: string,
  changes: Record<string, unknown>,
): Promise<{ before: RecordData; after: RecordData }> {
  await lockRecord(tx, recordId);
  checkDataChanges(await templateOfRecord(tx, recordId), changes);
  const row = await tx.medicalRecord.findUniqueOrThrow({ where: { id: recordId }, select: { data: true } });
  const before = parseRecordData(row.data);
  const after = applyDataChanges(before, changes);
  if (row.data === null || !sameRecordData(before, after)) {
    await tx.medicalRecord.update({ where: { id: recordId }, data: { data: JSON.stringify(after) }, select: { id: true } });
  }
  return { before, after };
}

/** Audit entries for the payload: one `data.<key>` per changed key, `null` where the key is absent. */
export function dataDiff(before: RecordData, after: RecordData): {
  affectedFields: string[];
  fieldsBefore: Record<string, string | null>;
  fieldsAfter: Record<string, string | null>;
} {
  const keys = [ ...new Set([ ...Object.keys(before), ...Object.keys(after) ]) ].filter((k) => before[ k ] !== after[ k ]).sort();
  const affectedFields = keys.map((k) => `data.${k}`);
  const fieldsBefore = Object.fromEntries(keys.map((k) => [ `data.${k}`, before[ k ] ?? null ]));
  const fieldsAfter = Object.fromEntries(keys.map((k) => [ `data.${k}`, after[ k ] ?? null ]));
  return { affectedFields, fieldsBefore, fieldsAfter };
}

export function sameRecordData(a: RecordData, b: RecordData): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => b[ k ] === a[ k ]);
}
