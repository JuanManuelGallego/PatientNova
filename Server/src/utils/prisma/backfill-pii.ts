import { prisma } from './prisma-client.js';
import { config } from '../config/config.js';
import { logger } from '../api/logger.js';
import { decrypt, encrypt, isEncrypted } from '../encryption/field-encryption.js';
import { BLIND_INDEXES, ENCRYPTED_FIELDS } from '../encryption/encrypted-fields.js';
import { PII_VERSION } from '../encryption/blind-index.js';

/**
 * Encrypts legacy plaintext PII and writes its blind indexes, for rows whose `piiVersion` is
 * missing or older than PII_VERSION (also the rehash path after a key/normalization change).
 *
 * - Idempotent and resumable: already-encrypted values are kept, rows are walked by id.
 * - Raw SQL, so `updatedAt` is preserved and no audit rows are produced.
 * - Optimistic: a row changed by the app since it was read (different `updatedAt`) is skipped;
 *   the app's own write already encrypted and indexed it, or the next run will.
 * - Without ENCRYPTION_KEY (local dev) only the blind indexes are written and rows stay unversioned.
 */
const TABLES = [
  { model: 'Patient', table: 'patients' },
  { model: 'Reminder', table: 'reminders' },
  { model: 'MedicalRecord', table: 'medical_records' },
] as const;

export interface BackfillResult {
  model: string;
  scanned: number;
  updated: number;
  skipped: number;
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export async function backfillPii(opts: { batchSize?: number } = {}): Promise<BackfillResult[]> {
  const batchSize = opts.batchSize ?? 500;
  const key = config.encryption.key;
  const results: BackfillResult[] = [];

  for (const { model, table } of TABLES) {
    const fields = [ ...(ENCRYPTED_FIELDS[ model ] ?? []) ];
    const indexes = Object.entries(BLIND_INDEXES[ model ] ?? {});
    const result: BackfillResult = { model, scanned: 0, updated: 0, skipped: 0 };
    let lastId = '00000000-0000-0000-0000-000000000000';

    for (;;) {
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT "id"::text AS "id", "updatedAt", "piiVersion", ${fields.map(quote).join(', ')}
         FROM ${quote(table)}
         WHERE ("piiVersion" IS NULL OR "piiVersion" < $1) AND "id" > CAST($2 AS uuid)
         ORDER BY "id"
         LIMIT ${Number(batchSize)}`,
        PII_VERSION,
        lastId,
      );
      if (rows.length === 0) break;
      lastId = rows[ rows.length - 1 ]!.id as string;
      result.scanned += rows.length;

      for (const row of rows) {
        const assignments: string[] = [];
        const params: unknown[] = [];
        const set = (column: string, value: unknown, cast = '') => {
          params.push(value);
          assignments.push(`${quote(column)} = $${params.length}${cast}`);
        };

        const plaintext: Record<string, string | null> = {};
        for (const field of fields) {
          const value = row[ field ];
          if (typeof value !== 'string') {
            plaintext[ field ] = null;
            continue;
          }
          const encrypted = isEncrypted(value);
          plaintext[ field ] = encrypted ? (key ? decrypt(value, key) : null) : value;
          if (!encrypted && key) set(field, encrypt(value, key));
        }
        for (const [ field, { column, derive } ] of indexes) {
          // Encrypted value we cannot decrypt (no key): leave its index alone.
          if (row[ field ] !== null && plaintext[ field ] === null) continue;
          const derived = derive(plaintext[ field ] ?? null);
          set(column, derived, Array.isArray(derived) ? '::text[]' : '');
        }
        if (key) set('piiVersion', PII_VERSION, '::smallint');

        if (assignments.length === 0) {
          result.skipped++;
          continue;
        }
        params.push(row.id, row.updatedAt);
        const changed = await prisma.$executeRawUnsafe(
          `UPDATE ${quote(table)} SET ${assignments.join(', ')}
           WHERE "id" = CAST($${params.length - 1} AS uuid) AND "updatedAt" = $${params.length}`,
          ...params,
        );
        if (changed === 1) result.updated++;
        else result.skipped++;
      }
    }

    results.push(result);
    logger.info(result, 'PII backfill finished for model');
  }

  return results;
}
