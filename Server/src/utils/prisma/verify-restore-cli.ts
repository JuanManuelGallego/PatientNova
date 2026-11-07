import { prisma } from './prisma-client.js';
import { verifyRestore } from './verify-restore.js';

verifyRestore()
  .then(({ read, decrypted }) => {
    console.log(`Patients read: ${read}, decrypted: ${decrypted}`);
    if (read === 0 || decrypted !== read) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect().then(() => process.exit(process.exitCode ?? 0));
  });
