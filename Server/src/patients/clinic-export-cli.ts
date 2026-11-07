import { prisma } from '../utils/prisma/prisma-client.js';
import { buildClinicExport } from './clinic-export.service.js';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const clinicId = args[ 0 ];

/** Writes readable patient data to stdout, so it must be piped into `age`; see `docs/operations.md`. */
async function main() {
  if (!clinicId || args.length !== 1) throw new Error('Usage: pnpm --silent run clinic:export <clinicUserId> | age --recipient age1... --output clinic.json.age');
  if (process.stdout.isTTY) throw new Error('Refusing to print patient data to a terminal: pipe it into age');
  const body = JSON.stringify(await buildClinicExport(clinicId));
  await new Promise<void>((resolve, reject) => process.stdout.write(body, (err) => (err ? reject(err) : resolve())));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect().then(() => process.exit(process.exitCode ?? 0));
  });
