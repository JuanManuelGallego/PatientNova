import { createHash } from 'node:crypto';
import type { ClientRateLimitInfo, IncrementResponse, Options, Store } from 'express-rate-limit';
import { prisma } from '../utils/prisma/prisma-client.js';

const PURGE_AFTER_MS = 24 * 60 * 60 * 1000;
const PURGE_PROBABILITY = 1 / 200;

/**
 * Fixed-window rate-limit counters in Postgres, so limits hold across processes and restarts
 * (the in-memory store resets per instance). One atomic upsert per hit. Keys are hashed, so
 * emails and IPs are never stored in clear. Old windows are purged opportunistically.
 */
export class PgRateLimitStore implements Store {
  localKeys = false;
  private windowMs = 60_000;

  constructor(readonly prefix: string) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private bucketKey(key: string): string {
    return `${this.prefix}${createHash('sha256').update(key).digest('hex').slice(0, 40)}`;
  }

  private currentWindowStart(now = Date.now()): Date {
    return new Date(Math.floor(now / this.windowMs) * this.windowMs);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const windowStart = this.currentWindowStart();
    const row = await prisma.rateLimitBucket.findUnique({
      where: { key_windowStart: { key: this.bucketKey(key), windowStart } },
    });
    if (!row) return undefined;
    return { totalHits: row.hits, resetTime: new Date(windowStart.getTime() + this.windowMs) };
  }

  async increment(key: string): Promise<IncrementResponse> {
    const windowStart = this.currentWindowStart();
    const rows = await prisma.$queryRaw<{ hits: number }[]>`
      INSERT INTO "rate_limit_buckets" ("key", "windowStart", "hits")
      VALUES (${this.bucketKey(key)}, ${windowStart}, 1)
      ON CONFLICT ("key", "windowStart")
      DO UPDATE SET "hits" = "rate_limit_buckets"."hits" + 1
      RETURNING "hits"`;
    if (Math.random() < PURGE_PROBABILITY) void this.purge();
    return { totalHits: Number(rows[0]?.hits ?? 1), resetTime: new Date(windowStart.getTime() + this.windowMs) };
  }

  async decrement(key: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "rate_limit_buckets" SET "hits" = GREATEST("hits" - 1, 0)
      WHERE "key" = ${this.bucketKey(key)} AND "windowStart" = ${this.currentWindowStart()}`;
  }

  async resetKey(key: string): Promise<void> {
    await prisma.rateLimitBucket.deleteMany({ where: { key: this.bucketKey(key) } });
  }

  async purge(): Promise<void> {
    try {
      await prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - PURGE_AFTER_MS) } } });
    } catch {
      // best-effort housekeeping; never affects a request
    }
  }
}
