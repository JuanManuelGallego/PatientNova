import { prisma } from './prisma-client.js';
import { backfillPii } from './backfill-pii.js';

// Runs on every start (after `prisma migrate deploy`); a no-op once all rows are processed.
backfillPii()
  .then((results) => {
    for (const r of results) console.log(`PII backfill ${r.model}: scanned ${r.scanned}, updated ${r.updated}, skipped ${r.skipped}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect().then(() => process.exit(process.exitCode ?? 0));
  });
