import { logger } from '../../utils/api/logger.js';
import { runInAuditContext } from '../../audit-log/audit-log-context.js';
import { ActionSource } from '../../../generated/prisma/enums.ts';
import { googleConnectionRepository } from '../../google/google-connection.repository.js';
import { isGoogleConfigured, verifyConnection, type ConnectionCheckResult } from '../../google/google-connection.service.js';

const JOB_CTX = { actorId: 'scheduler', actorDisplayName: 'Scheduler Worker', source: ActionSource.JOB };

/**
 * Daily check of every active Google connection, so an expired one shows up in the provider's
 * banner before they need a Meet link. One provider's failure never stops the others.
 */
export async function checkGoogleConnectionsWorker(): Promise<void> {
  if (!isGoogleConfigured()) return;
  const userIds = await googleConnectionRepository.findActiveUserIds();
  const counts: Record<ConnectionCheckResult | 'error', number> = {
    valid: 0, expired: 0, not_connected: 0, unknown: 0, error: 0,
  };

  await runInAuditContext(JOB_CTX, async () => {
    for (const userId of userIds) {
      try {
        counts[await verifyConnection(userId)] += 1;
      } catch {
        counts.error += 1;
        logger.error({ userId }, 'Google connection check crashed');
      }
    }
  });

  logger.info({ checked: userIds.length, ...counts }, 'Google connections checked');
}
