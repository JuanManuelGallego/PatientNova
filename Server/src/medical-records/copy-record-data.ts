import { prisma } from '../utils/prisma/prisma-client.js';
import { quote } from '../utils/prisma/backfill-pii.js';
import { activeKeyring } from '../utils/encryption/keyring.js';
import { decrypt, encrypt, isEncrypted, type Keyring } from '../utils/encryption/field-encryption.js';
import { logger } from '../utils/api/logger.js';
import { applyDataChanges, CLINICAL_KEYS, columnChanges, parseRecordData, sameRecordData, type ClinicalColumns, type RecordData } from './record-data.js';

export interface CopyResult {
  scanned: number;
  written: number;
  unchanged: number;
  skipped: number;
  failed: string[];
  dryRun: boolean;
}

export interface VerifyResult {
  scanned: number;
  missing: string[];
  mismatched: { recordId: string; keys: string[] }[];
  failed: string[];
}

export interface CopyOptions {
  batchSize?: number;
  dryRun?: boolean;
  onBatch?: () => Promise<void>;
}

interface Row {
  id: string;
  updatedAt: Date;
  columns: ClinicalColumns;
  payload: RecordData | null;
}

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

function open(value: unknown, keyring: Keyring | null): string | null {
  if (typeof value !== 'string') return null;
  if (!isEncrypted(value)) return value;
  if (!keyring) throw new Error('encrypted value without ENCRYPTION_KEY');
  return decrypt(value, keyring);
}

function batchSizeOf(opts: { batchSize?: number }): number {
  const size = Number(opts.batchSize ?? 500);
  if (!Number.isInteger(size) || size < 1) throw new Error('batchSize must be a positive integer');
  return size;
}

async function forEachBatch(
  batchSize: number,
  keyring: Keyring | null,
  visit: (rows: Row[], failed: string[]) => Promise<void>,
  onBatch?: () => Promise<void>,
): Promise<{ scanned: number; failed: string[] }> {
  const failed: string[] = [];
  let scanned = 0;
  let lastId = ZERO_UUID;
  for (;;) {
    const raw = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT "id"::text AS "id", "updatedAt", "data", ${CLINICAL_KEYS.map(quote).join(', ')}
       FROM "medical_records"
       WHERE "id" > CAST($1 AS uuid)
       ORDER BY "id"
       LIMIT ${batchSize}`,
      lastId,
    );
    if (raw.length === 0) break;
    lastId = raw[ raw.length - 1 ]!.id as string;
    scanned += raw.length;
    await onBatch?.();

    const rows: Row[] = [];
    for (const r of raw) {
      const id = r.id as string;
      try {
        const columns: ClinicalColumns = {};
        for (const key of CLINICAL_KEYS) columns[ key ] = open(r[ key ], keyring);
        rows.push({ id, updatedAt: r.updatedAt as Date, columns, payload: r.data === null ? null : parseRecordData(open(r.data, keyring)) });
      } catch {
        failed.push(id);
        logger.error({ recordId: id }, 'Record payload copy: a value could not be opened');
      }
    }
    await visit(rows, failed);
  }
  return { scanned, failed };
}

const targetOf = (row: Row): RecordData => applyDataChanges(row.payload ?? {}, columnChanges(row.columns));

export async function copyRecordData(opts: CopyOptions = {}): Promise<CopyResult> {
  const keyring = activeKeyring();
  const dryRun = opts.dryRun === true;
  const result: CopyResult = { scanned: 0, written: 0, unchanged: 0, skipped: 0, failed: [], dryRun };

  const { scanned, failed } = await forEachBatch(batchSizeOf(opts), keyring, async (rows) => {
    for (const row of rows) {
      const target = targetOf(row);
      if (row.payload !== null && sameRecordData(target, row.payload)) {
        result.unchanged++;
        continue;
      }
      if (dryRun) {
        result.written++;
        continue;
      }
      const json = JSON.stringify(target);
      const changed = await prisma.$executeRawUnsafe(
        'UPDATE "medical_records" SET "data" = $1 WHERE "id" = CAST($2 AS uuid) AND "updatedAt" = $3',
        keyring ? encrypt(json, keyring) : json,
        row.id,
        row.updatedAt,
      );
      if (changed === 1) result.written++;
      else result.skipped++;
    }
  }, opts.onBatch);

  result.scanned = scanned;
  result.failed = failed;
  logger.info({ ...result, failed: failed.length }, 'Record payload copy finished');
  return result;
}

export async function verifyRecordData(opts: { batchSize?: number } = {}): Promise<VerifyResult> {
  const keyring = activeKeyring();
  const result: VerifyResult = { scanned: 0, missing: [], mismatched: [], failed: [] };

  const { scanned, failed } = await forEachBatch(batchSizeOf(opts), keyring, async (rows) => {
    for (const row of rows) {
      if (row.payload === null) {
        result.missing.push(row.id);
        continue;
      }
      const payload = row.payload;
      const keys = CLINICAL_KEYS.filter((key) => (row.columns[ key ] || undefined) !== payload[ key ]);
      if (keys.length > 0) result.mismatched.push({ recordId: row.id, keys });
    }
  });

  result.scanned = scanned;
  result.failed = failed;
  return result;
}
