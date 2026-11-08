import { keyId } from './field-encryption.js';

const HOW = 'Pipe the key in, so it never shows on screen or in the shell history: '
  + 'read -rs KEY; printf \'%s\\n\' "$KEY" | pnpm run pii:key-id';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
}

/** Prints the key id of the 64-hex key read from stdin, and nothing else. The key is never printed. */
async function main() {
  // Never echo arguments: a key typed there is the mistake this refuses.
  if (process.argv.slice(2).some((arg) => arg !== '--')) throw new Error(`pii:key-id takes no arguments. ${HOW}`);
  if (process.stdin.isTTY) throw new Error(HOW);
  const key = (await readStdin()).trim();
  if (!/^[0-9a-f]{64}$/i.test(key)) throw new Error('Expected one 64-character hex key on stdin');
  console.log(keyId(key));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'pii:key-id failed');
  process.exitCode = 1;
});
