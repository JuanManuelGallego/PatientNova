import { prisma } from '../utils/prisma/prisma-client.js';
import { restorePatientAccess, revokePatientConsents } from './consent-revocation.service.js';

const USAGE = [
  'Usage: pnpm run consent:revoke <patientId> [--block-portal] [--stop-messages]',
  '       pnpm run consent:revoke <patientId> [--restore-portal] [--restore-messages]',
].join('\n');
const FLAGS = new Set([ '--block-portal', '--stop-messages', '--restore-portal', '--restore-messages' ]);

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const positional = args.filter((arg) => !FLAGS.has(arg));
const patientId = positional[ 0 ];
const has = (flag: string) => args.includes(flag);

async function main() {
  const restoring = has('--restore-portal') || has('--restore-messages');
  const closing = has('--block-portal') || has('--stop-messages');
  if (!patientId || positional.length !== 1 || patientId.startsWith('-') || (restoring && closing)) throw new Error(USAGE);
  const result = restoring
    ? await restorePatientAccess(patientId, { portal: has('--restore-portal'), messages: has('--restore-messages') })
    : await revokePatientConsents(patientId, { blockPortal: has('--block-portal'), stopMessages: has('--stop-messages') });
  console.log(JSON.stringify(result));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect().then(() => process.exit(process.exitCode ?? 0));
  });
