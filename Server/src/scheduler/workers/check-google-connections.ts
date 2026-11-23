import { logger } from '../../utils/api/logger.js';
import { runInAuditContext } from '../../audit-log/audit-log-context.js';
import { ActionSource, AdminStatus } from '../../../generated/prisma/enums.ts';
import { prisma } from '../../utils/prisma/prisma-client.js';
import { googleConnectionRepository } from '../../google/google-connection.repository.js';
import { isGoogleConfigured, verifyConnection, type ConnectionCheckResult } from '../../google/google-connection.service.js';

const JOB_CTX = { actorId: 'scheduler', actorDisplayName: 'Scheduler Worker', source: ActionSource.JOB };

export async function checkGoogleConnectionsWorker(): Promise<void> {
  if (!isGoogleConfigured()) return;
  const userIds = await googleConnectionRepository.findActiveUserIds();
  const counts: Record<ConnectionCheckResult | 'error', number> = {
    valid: 0, expired: 0, not_connected: 0, unknown: 0, error: 0,
  };

  await runInAuditContext(JOB_CTX, async () => {
    for (const userId of userIds) {
      try {
        const active = await prisma.user.findUnique({
          where: { id: userId, status: AdminStatus.ACTIVE, isDeleted: false },
          select: { id: true },
        });
        if (!active) continue;

        counts[await verifyConnection(userId)] += 1;
      } catch {
        counts.error += 1;
        logger.error({ userId }, 'Google connection check crashed');
      }
    }
  });

  logger.info({ checked: Object.values(counts).reduce((sum, count) => sum + count, 0), ...counts }, 'Google connections checked');
}
