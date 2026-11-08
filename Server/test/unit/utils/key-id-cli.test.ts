import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { keyId } from '../../../src/utils/encryption/field-encryption.js';

const CLI = fileURLToPath(new URL('../../../src/utils/encryption/key-id-cli.ts', import.meta.url));
const KEY = 'ab'.repeat(32);

function run(input: string, args: string[] = []) {
  const result = spawnSync(process.execPath, [ '--import', 'tsx', CLI, ...args ], { input, encoding: 'utf8', timeout: 30_000 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('pii:key-id', () => {
  it('prints only the key id of the key read from stdin', () => {
    const result = run(`${KEY}\n`);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${keyId(KEY)}\n`);
    expect(result.stderr).not.toContain(KEY);
  }, 30_000);

  it('gives the same id for an uppercase key', () => {
    expect(run(KEY.toUpperCase()).stdout).toBe(`${keyId(KEY)}\n`);
  }, 30_000);

  it('refuses input that is not one 64-hex key, without echoing it', () => {
    const almost = `${KEY.slice(0, 63)}z`;
    const result = run(almost);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Expected one 64-character hex key on stdin');
    expect(result.stderr).not.toContain(almost);
  }, 30_000);

  it('refuses a key passed as an argument, without echoing it', () => {
    const result = run('', [ KEY ]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('takes no arguments');
    expect(result.stderr).not.toContain(KEY);
  }, 30_000);
});
