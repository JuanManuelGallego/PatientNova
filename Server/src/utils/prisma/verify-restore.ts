import { prisma } from './prisma-client.js';

/** Restore rehearsal check: proves the keys in the environment can read a restored database. */
export async function verifyRestore(sample = 20): Promise<{ read: number; decrypted: number }> {
  const rows = await prisma.patient.findMany({ take: sample, select: { name: true } });
  return { read: rows.length, decrypted: rows.filter((row) => !row.name.startsWith('enc:')).length };
}
