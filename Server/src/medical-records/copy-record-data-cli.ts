import { prisma } from '../utils/prisma/prisma-client.js';
import { copyRecordData, verifyRecordData } from './copy-record-data.js';

const USAGE = [
  'Usage: pnpm run records:copy-data [--dry-run] [--batch-size N]   # copies the clinical columns into the payload',
  '       pnpm run records:copy-data --verify [--batch-size N]      # compares every column with its payload key',
].join('\n');

function parseArgs(argv: string[]): { verify: boolean; dryRun: boolean; batchSize?: number } {
  const args = argv.filter((arg) => arg !== '--');
  const opts: { verify: boolean; dryRun: boolean; batchSize?: number } = { verify: false, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[ i ]!;
    if (arg === '--verify') opts.verify = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--batch-size' && /^[1-9][0-9]*$/.test(args[ i + 1 ] ?? '')) opts.batchSize = Number(args[ ++i ]);
    else throw new Error(USAGE);
  }
  if (opts.verify && opts.dryRun) throw new Error(USAGE);
  return opts;
}

async function main() {
  const { verify, dryRun, batchSize } = parseArgs(process.argv.slice(2));
  const size = batchSize === undefined ? {} : { batchSize };

  if (verify) {
    const r = await verifyRecordData(size);
    console.log(`Record payload verify: scanned ${r.scanned}, missing ${r.missing.length}, mismatched ${r.mismatched.length}, failed ${r.failed.length}`);
    for (const id of r.missing) console.log(`  missing ${id}`);
    for (const m of r.mismatched) console.log(`  mismatched ${m.recordId}: ${m.keys.join(', ')}`);
    for (const id of r.failed) console.log(`  failed ${id}`);
    if (r.missing.length + r.mismatched.length + r.failed.length > 0) process.exitCode = 1;
    return;
  }

  const r = await copyRecordData({ ...size, dryRun });
  const verb = dryRun ? 'would write' : 'written';
  console.log(`Record payload copy${dryRun ? ' (dry run, nothing written)' : ''}: scanned ${r.scanned}, ${verb} ${r.written}, unchanged ${r.unchanged}, skipped ${r.skipped}, failed ${r.failed.length}`);
  for (const id of r.failed) console.log(`  failed ${id}`);
  if (r.skipped > 0) console.log('Rows changed while the copy ran were skipped: run it again.');
  if (r.failed.length > 0 || r.skipped > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect().then(() => process.exit(process.exitCode ?? 0));
  });
