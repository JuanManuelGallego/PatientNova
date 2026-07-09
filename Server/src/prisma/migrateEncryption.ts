/**
 * One-time data migration script to encrypt existing plaintext sensitive fields.
 *
 * Usage: npx tsx src/prisma/migrateEncryption.ts
 *
 * IMPORTANT: This script creates its own PrismaClient WITHOUT the encryption
 * extension to avoid double-encryption. Run BEFORE deploying the extended client.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { encrypt, isEncrypted } from "../utils/encryption.js";
import { ENCRYPTED_FIELDS } from "../utils/encryptedFields.js";

const BATCH_SIZE = 100;

const key = process.env.ENCRYPTION_KEY;
if (!key || key.length !== 64) {
  console.error("ENCRYPTION_KEY must be a 64-character hex string");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type ModelDelegate = {
  findMany: (args: {
    skip: number;
    take: number;
    select: Record<string, boolean>;
  }) => Promise<Record<string, unknown>[]>;
  update: (args: {
    where: { id: string };
    data: Record<string, unknown>;
  }) => Promise<unknown>;
  count: () => Promise<number>;
};

async function migrateModel(modelName: string) {
  const fields = ENCRYPTED_FIELDS[modelName];
  if (!fields) return;

  const delegate = (prisma as unknown as Record<string, ModelDelegate>)[
    modelName.charAt(0).toLowerCase() + modelName.slice(1)
  ];
  if (!delegate) {
    console.warn(`No Prisma delegate found for model: ${modelName}`);
    return;
  }

  const total = await delegate.count();
  console.log(
    `\n[${modelName}] ${total} records, encrypting fields: ${[...fields].join(", ")}`,
  );

  let processed = 0;
  let encrypted = 0;

  while (processed < total) {
    const select: Record<string, boolean> = { id: true };
    for (const f of fields) select[f] = true;

    const records = await delegate.findMany({
      skip: processed,
      take: BATCH_SIZE,
      select,
    });

    if (records.length === 0) break;

    for (const record of records) {
      const updates: Record<string, string> = {};
      const id = record.id as string;

      for (const field of fields) {
        const value = record[field];
        if (typeof value !== "string" || !value) continue;
        if (isEncrypted(value)) continue; // already encrypted

        updates[field] = encrypt(value, key!);
      }

      if (Object.keys(updates).length > 0) {
        await delegate.update({ where: { id }, data: updates });
        encrypted++;
      }
    }

    processed += records.length;
    console.log(
      `  [${modelName}] ${processed}/${total} checked, ${encrypted} encrypted`,
    );
  }

  console.log(`  [${modelName}] Done — ${encrypted} records encrypted`);
}

async function main() {
  console.log("Starting encryption migration...\n");

  for (const modelName of Object.keys(ENCRYPTED_FIELDS)) {
    await migrateModel(modelName);
  }

  console.log("\nEncryption migration complete.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
