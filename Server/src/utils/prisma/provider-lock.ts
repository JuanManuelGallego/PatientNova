import type { TransactionClient } from './prisma-client.js';

const PROVIDER_LOCK_NAMESPACE = 0x504e5601;

export async function withProviderLock(tx: TransactionClient, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PROVIDER_LOCK_NAMESPACE}::int, hashtext(${userId}))`;
}
