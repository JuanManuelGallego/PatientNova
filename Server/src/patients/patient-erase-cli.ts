import { prisma } from '../utils/prisma/prisma-client.js';
import { erasePatient } from './patient-erasure.service.js';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const confirm = args.includes('--confirm');
const positional = args.filter((arg) => arg !== '--confirm');
const patientId = positional[ 0 ];

async function main() {
  if (!patientId || positional.length !== 1 || patientId.startsWith('-')) {
    throw new Error('Usage: pnpm run patient:erase <patientId> [--confirm]');
  }
  const result = await erasePatient(patientId, { confirm });
  console.log(JSON.stringify(result));
  if (!confirm) console.log('Nothing changed. Add --confirm to erase.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect().then(() => process.exit(process.exitCode ?? 0));
  });
