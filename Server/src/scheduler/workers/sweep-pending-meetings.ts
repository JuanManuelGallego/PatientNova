import { logger } from '../../utils/api/logger.js';
import { runInAuditContext } from '../../audit-log/audit-log-context.js';
import { ActionSource } from '../../../generated/prisma/enums.ts';
import { sweepPendingMeetings } from '../../portal/portal-meeting.service.js';

const JOB_CTX = { actorId: 'scheduler', actorDisplayName: 'Scheduler Worker', source: ActionSource.JOB };

/** Every 15 min: a Meet link still `PENDING` after the timeout goes to the provider (`NEEDS_LINK`). */
export async function sweepPendingMeetingsWorker(): Promise<void> {
  const moved = await runInAuditContext(JOB_CTX, () => sweepPendingMeetings());
  if (moved > 0) logger.info({ moved }, 'Pending meeting links handed to providers');
}
