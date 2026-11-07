import { prisma } from './prisma-client.js';
import { confirmKeyId, reencryptPii, type ReencryptResult } from './reencrypt-pii.js';
import { activeKeyring } from '../encryption/keyring.js';
import { EncryptionError } from '../encryption/field-encryption.js';

const USAGE = [
  'Usage: pnpm run pii:reencrypt                 # report only, writes nothing',
  '       pnpm run pii:reencrypt --key-id <kid>  # re-encrypts; <kid> is the new key id pii:key-id printed',
].join('\n');

/** No arguments: report. `--key-id <kid>` (or `--key-id=<kid>`): write. Anything else is never echoed. */
function parseArgs(argv: string[]): { keyId?: string } {
  const args = argv.filter((arg) => arg !== '--');
  if (args.length === 0) return {};
  if (args.length === 2 && args[ 0 ] === '--key-id') return { keyId: args[ 1 ]! };
  if (args.length === 1 && args[ 0 ]!.startsWith('--key-id=')) return { keyId: args[ 0 ]!.slice('--key-id='.length) };
  throw new Error(USAGE);
}

const total = (counts: number[]) => counts.reduce((sum, n) => sum + n, 0);

/** Where each value no key opens is: model, field and record id, never the value. */
function printFailures(results: ReencryptResult[]) {
  for (const r of results) {
    for (const f of r.failures) console.log(`  ${r.model} / ${f.field} / ${f.recordId}`);
  }
}

async function main() {
  const { keyId } = parseArgs(process.argv.slice(2));
  const keyring = activeKeyring();
  if (!keyring) throw new EncryptionError('ENCRYPTION_KEY is required to re-encrypt PII');
  console.log(`Current key id: ${keyring.currentId}`);

  if (keyId === undefined) {
    const results = await reencryptPii({ dryRun: true });
    for (const r of results) {
      console.log(`PII re-encrypt report ${r.model}: stale ${r.scanned}, no key opens ${r.failed}`);
    }
    const failed = total(results.map((r) => r.failed));
    if (failed > 0) {
      console.log(`${failed} row(s) hold a value no configured key opens (model / field / record id):`);
      printFailures(results);
      process.exitCode = 1;
    }
    if (total(results.map((r) => r.scanned)) === 0) {
      console.log(`Every stored ciphertext is under key ${keyring.currentId}. Nothing was written.`);
    } else {
      console.log('Nothing was written. To re-encrypt, check that the current key id above is the new key\'s id '
        + '(pnpm run pii:key-id), then run it again with --key-id <that id>.');
    }
    return;
  }

  confirmKeyId(keyId, keyring);
  const results = await reencryptPii({ keyId });
  for (const r of results) {
    console.log(`PII re-encrypt ${r.model}: scanned ${r.scanned}, updated ${r.updated}, skipped ${r.skipped}, failed ${r.failed}`);
  }

  const failed = total(results.map((r) => r.failed));
  const skipped = total(results.map((r) => r.skipped));
  if (skipped > 0) {
    console.log(`${skipped} row(s) changed while being re-encrypted: run it again.`);
  }
  if (failed > 0) {
    console.log(`${failed} row(s) hold a value no configured key opens. Those values were left unchanged and the `
      + 'other values of those rows were re-encrypted. Examine every field listed (model / field / record id), '
      + 'then run it again:');
    printFailures(results);
    process.exitCode = 1;
  } else if (skipped === 0) {
    console.log(`Every stored ciphertext is under key ${keyring.currentId}.`);
  }
}

main()
  .catch((error) => {
    // Name and message only: never a stack of row data.
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'PII re-encrypt failed');
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect().then(() => process.exit(process.exitCode ?? 0));
  });
