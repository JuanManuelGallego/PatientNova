import { prisma } from './prisma-client.js';
import { quote } from './backfill-pii.js';
import { activeKeyring } from '../encryption/keyring.js';
import { logger } from '../api/logger.js';
import {
  decrypt,
  encrypt,
  EncryptionError,
  isCurrent,
  isEncrypted,
  type Keyring,
} from '../encryption/field-encryption.js';
import { ENCRYPTED_FIELDS, ENCRYPTED_JSON_FIELDS } from '../encryption/encrypted-fields.js';

/** Table and id type of every model with encrypted fields (must cover every key of ENCRYPTED_FIELDS). */
export const REENCRYPT_TABLES: Record<string, { table: string; id: 'uuid' | 'text' }> = {
  User: { table: 'users', id: 'text' },
  MedicalRecord: { table: 'medical_records', id: 'uuid' },
  FamilyMember: { table: 'family_members', id: 'uuid' },
  EvolutionNote: { table: 'evolution_notes', id: 'uuid' },
  Patient: { table: 'patients', id: 'uuid' },
  Appointment: { table: 'appointments', id: 'uuid' },
  Reminder: { table: 'reminders', id: 'uuid' },
  AuditLog: { table: 'AuditLog', id: 'text' },
  GoogleConnection: { table: 'google_connections', id: 'text' },
  BookingRequest: { table: 'booking_requests', id: 'uuid' },
};

/** A stored value no configured key opens: where it is, never what it holds. */
export interface ReencryptFailure {
  field: string;
  recordId: string;
}

/**
 * Per model: `scanned` rows hold at least one value that is ciphertext not under the current key (stale).
 * `failed` rows hold at least one value no configured key opens, and `failures` lists every such field.
 * A dry run writes nothing, so its `updated` and `skipped` stay 0.
 */
export interface ReencryptResult {
  model: string;
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: ReencryptFailure[];
}

export type RowOutcome = 'updated' | 'skipped' | 'failed';

export interface ReencryptOptions {
  batchSize?: number;
  /** Only count stale rows and values no key opens: no UPDATE is ever issued. */
  dryRun?: boolean;
  /** Required unless `dryRun`: the current key id as the operator confirmed it (see `confirmKeyId`). */
  keyId?: string;
}

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const KEY_ID = /^[0-9a-f]{8}$/;

export class KeyIdMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyIdMismatchError';
  }
}

/**
 * Throws unless `expected` is the keyring's current key id. A swapped or missing key would otherwise
 * re-encrypt everything under the wrong key. The given value is echoed only when it has the shape of a key
 * id, so a key pasted there by mistake never reaches the output.
 */
export function confirmKeyId(expected: string | undefined, keyring: Keyring): void {
  const given = expected?.trim().toLowerCase() ?? '';
  if (!KEY_ID.test(given)) {
    throw new KeyIdMismatchError('--key-id must be the 8 hex characters pii:key-id printed for the new key; nothing was written');
  }
  if (given !== keyring.currentId) {
    throw new KeyIdMismatchError(
      `--key-id ${given} does not match the current key id ${keyring.currentId}; nothing was written`,
    );
  }
}

function tableOf(model: string) {
  const entry = REENCRYPT_TABLES[ model ];
  const fields = ENCRYPTED_FIELDS[ model ];
  if (!entry || !fields) throw new Error(`No re-encrypt table for model ${model}`);
  return { ...entry, fields: [ ...fields ] };
}

/** The column as text: JSON fields hold ciphertext as a JSON string, read without parsing. */
function textOf(model: string, field: string): string {
  return ENCRYPTED_JSON_FIELDS[ model ]?.has(field) ? `(${quote(field)} #>> '{}')` : quote(field);
}

const idParam = (id: 'uuid' | 'text', n: number) => (id === 'uuid' ? `CAST($${n} AS uuid)` : `$${n}`);

/** Opens every stale field of a row: the values that can move, and the fields no configured key opens. */
function planRow(model: string, row: Record<string, unknown>, keyring: Keyring) {
  const moves: { field: string; old: string; plaintext: string }[] = [];
  const failedFields: string[] = [];
  for (const field of tableOf(model).fields) {
    const value = row[ field ];
    if (typeof value !== 'string' || !isEncrypted(value) || isCurrent(value, keyring)) continue;
    try {
      moves.push({ field, old: value, plaintext: decrypt(value, keyring) });
    } catch {
      failedFields.push(field);
    }
  }
  return { moves, failedFields };
}

/**
 * Moves one row's ciphertext to the keyring's current key. The row is as the batch query selects it:
 * `id` plus each encrypted field as text or null. A field changes only when it is ciphertext not under the
 * current key; plaintext (including redacted values) is never touched. A value no configured key opens stays
 * as it is and is logged (model, field and record id only), while every other stale field of the row still
 * moves. The UPDATE only lands while every changed field still holds the value read, so a row the app wrote
 * meanwhile is 'skipped'. A row with any value no key opens is 'failed', even when its other fields moved.
 * Database errors propagate.
 */
export async function reencryptRow(
  model: string,
  row: Record<string, unknown>,
  keyring: Keyring,
): Promise<{ outcome: RowOutcome; failedFields: string[] }> {
  const { table, id } = tableOf(model);
  const recordId = String(row.id);
  const { moves, failedFields } = planRow(model, row, keyring);
  for (const field of failedFields) {
    logger.error({ model, field, recordId }, 'PII re-encrypt: no configured key opens this value; value left unchanged');
  }

  let changed = 0;
  if (moves.length > 0) {
    const assignments: string[] = [];
    const guards: string[] = [];
    const params: unknown[] = [];
    for (const { field, old, plaintext } of moves) {
      const isJson = ENCRYPTED_JSON_FIELDS[ model ]?.has(field) ?? false;
      params.push(encrypt(plaintext, keyring));
      assignments.push(`${quote(field)} = ${isJson ? `to_jsonb($${params.length}::text)` : `$${params.length}`}`);
      params.push(old);
      guards.push(`${textOf(model, field)} = $${params.length}`);
    }
    params.push(recordId);
    changed = await prisma.$executeRawUnsafe(
      `UPDATE ${quote(table)} SET ${assignments.join(', ')}
       WHERE "id" = ${idParam(id, params.length)} AND ${guards.join(' AND ')}`,
      ...params,
    );
  }

  if (failedFields.length > 0) return { outcome: 'failed', failedFields };
  return { outcome: changed === 1 ? 'updated' : 'skipped', failedFields };
}

/**
 * Rewrites every stored ciphertext that is not `enc:v2:<current key id>:` under the current key, model by
 * model, paging by id. Resumable: a rerun picks up whatever is still stale. A dry run only counts. Otherwise
 * `keyId` must equal the current key id, checked before anything is read.
 */
export async function reencryptPii(opts: ReencryptOptions = {}): Promise<ReencryptResult[]> {
  const batchSize = Number(opts.batchSize ?? 500);
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('batchSize must be a positive integer');
  const keyring = activeKeyring();
  if (!keyring) throw new EncryptionError('ENCRYPTION_KEY is required to re-encrypt PII');
  const dryRun = opts.dryRun === true;
  if (!dryRun) confirmKeyId(opts.keyId, keyring);
  const current = `enc:v2:${keyring.currentId}:%`;
  const results: ReencryptResult[] = [];

  // The registry, not REENCRYPT_TABLES: a model without a table throws instead of staying under the old key.
  for (const model of Object.keys(ENCRYPTED_FIELDS)) {
    const { table, id, fields } = tableOf(model);
    const stale = fields
      .map((f) => `(${textOf(model, f)} ~ '^enc:v(1:|2:[0-9a-f]{8}:)' AND ${textOf(model, f)} NOT LIKE $1)`)
      .join(' OR ');
    const columns = fields.map((f) => `${textOf(model, f)} AS ${quote(f)}`).join(', ');
    const result: ReencryptResult = { model, scanned: 0, updated: 0, skipped: 0, failed: 0, failures: [] };
    let lastId = id === 'uuid' ? ZERO_UUID : '';

    for (;;) {
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT "id"::text AS "id", ${columns}
         FROM ${quote(table)}
         WHERE (${stale}) AND "id" > ${idParam(id, 2)}
         ORDER BY "id"
         LIMIT ${batchSize}`,
        current,
        lastId,
      );
      if (rows.length === 0) break;
      lastId = rows[ rows.length - 1 ]!.id as string;
      result.scanned += rows.length;

      for (const row of rows) {
        const recordId = String(row.id);
        let failedFields: string[];
        if (dryRun) {
          failedFields = planRow(model, row, keyring).failedFields;
          if (failedFields.length > 0) result.failed++;
        } else {
          const outcome = await reencryptRow(model, row, keyring);
          failedFields = outcome.failedFields;
          result[ outcome.outcome ]++;
        }
        for (const field of failedFields) result.failures.push({ field, recordId });
      }
    }

    results.push(result);
    const { failures, ...counts } = result;
    logger.info({ ...counts, failedFields: failures.length, dryRun }, 'PII re-encrypt finished for model');
  }

  return results;
}
