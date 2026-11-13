import { Channel } from '../../generated/prisma/enums.js';
import { config } from '../utils/config/config.js';
import { ONE_DAY_MS, ONE_HOUR_MS } from '../utils/config/constants.js';
import type { TransactionClient } from '../utils/prisma/prisma-client.js';

export type PaidCapReason = 'phone-cap' | 'provider-paid-cap' | 'paid-daily-cap';

export const PAID_CAP_LIMITS = { perPhonePerHour: 3, perProviderNumbersPerHour: 30 } as const;

async function distinctNumbersSince(tx: TransactionClient, since: Date, userId?: string): Promise<number> {
  const groups = await tx.bookingRequest.groupBy({
    by: [ 'verifiedPhoneHash' ],
    where: {
      contactChannel: Channel.WHATSAPP,
      verifiedPhoneHash: { not: null },
      createdAt: { gte: since },
      ...(userId && { userId }),
    },
  });
  return groups.length;
}

export async function checkPaidCaps(
  tx: TransactionClient,
  userId: string,
  phoneHash: string,
  now: Date,
): Promise<PaidCapReason | null> {
  const hourAgo = new Date(now.getTime() - ONE_HOUR_MS);
  const perPhone = await tx.bookingRequest.count({
    where: { userId, contactChannel: Channel.WHATSAPP, verifiedPhoneHash: phoneHash, createdAt: { gte: hourAgo } },
  });
  if (perPhone >= PAID_CAP_LIMITS.perPhonePerHour) return 'phone-cap';

  if (await distinctNumbersSince(tx, hourAgo, userId) >= PAID_CAP_LIMITS.perProviderNumbersPerHour) return 'provider-paid-cap';
  if (await distinctNumbersSince(tx, new Date(now.getTime() - ONE_DAY_MS)) >= config.portal.whatsappDailyCap) return 'paid-daily-cap';
  return null;
}

