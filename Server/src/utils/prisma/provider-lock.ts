import type { TransactionClient } from './prisma-client.js';

// Fixed namespace for provider-scoped advisory locks (two-int form), so the lock keyspace can't
// collide with any other advisory-lock user in the same database.
const PROVIDER_LOCK_NAMESPACE = 0x504e5601;

/**
 * Serializes calendar mutations for one provider until the surrounding transaction ends.
 *
 * Take it as the FIRST statement of any transaction that creates or moves an appointment or
 * blocked time. Always lock the provider before touching other rows (single lock order, so
 * transactions can't deadlock on each other). Never do external I/O while holding it.
 */
export async function withProviderLock(tx: TransactionClient, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PROVIDER_LOCK_NAMESPACE}::int, hashtext(${userId}))`;
}
