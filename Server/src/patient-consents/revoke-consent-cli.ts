import { prisma } from '../utils/prisma/prisma-client.js';
import { revokePatientConsents } from './patient-consent.service.js';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const blockPortal = args.includes('--block-portal');
const positional = args.filter((arg) => arg !== '--block-portal');
const patientId = positional[0];

async function main() {
  if (!patientId || positional.length !== 1 || patientId.startsWith('-')) {
    throw new Error('Usage: pnpm run consent:revoke <patientId> [--block-portal]');
  }
  const { revoked, portalBlocked } = await revokePatientConsents(patientId, { blockPortal });
  console.log(`Consents revoked: ${revoked}. Portal blocked now: ${portalBlocked}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect().then(() => process.exit(process.exitCode ?? 0));
  });
