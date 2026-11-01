import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import type { Prisma } from '../../generated/prisma/client.js';

export interface PortalOtpRow {
  id: string;
  codeHash: string;
  challengeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  lastSentAt: Date;
  sendWindowStart: Date;
  sendCount: number;
  failedCount: number;
  failedWindowStart: Date;
}

export const portalOtpRepository = {
  async ensureRow(tx: TransactionClient, userId: string, emailHash: string, now: Date): Promise<void> {
    await tx.portalOtp.createMany({
      data: [ {
        userId,
        emailHash,
        codeHash: '',
        expiresAt: now,
        lastSentAt: new Date(0),
        sendWindowStart: now,
        sendCount: 0,
      } ],
      skipDuplicates: true,
    });
  },

  async lockRow(tx: TransactionClient, userId: string, emailHash: string): Promise<PortalOtpRow | null> {
    const rows = await tx.$queryRaw<PortalOtpRow[]>`
      SELECT "id", "codeHash", "challengeHash", "expiresAt", "attempts", "consumedAt", "lastSentAt", "sendWindowStart", "sendCount",
        "failedCount", "failedWindowStart"
      FROM "portal_otps"
      WHERE "userId" = ${userId} AND "emailHash" = ${emailHash}
      FOR UPDATE`;
    return rows[0] ?? null;
  },

  countSentSince(tx: TransactionClient, userId: string, since: Date): Promise<number> {
    return tx.portalOtp.count({ where: { userId, lastSentAt: { gte: since } } });
  },

  async update(tx: TransactionClient, id: string, data: Prisma.PortalOtpUpdateInput): Promise<void> {
    await tx.portalOtp.update({ where: { id }, data });
  },

  async purgeSentBefore(before: Date): Promise<number> {
    const { count } = await prisma.portalOtp.deleteMany({ where: { lastSentAt: { lt: before } } });
    return count;
  },
};
