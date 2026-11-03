import { runInAuditContext } from '../../audit-log/audit-log-context.js';
import { ActionSource } from '../../../generated/prisma/enums.ts';
import { PROVISION_MEET_RETRY_LIMIT } from '../../utils/config/constants.js';
import { provisionMeet, type ProvisionMeetJob } from '../../portal/portal-meeting.service.js';

const JOB_CTX = { actorId: 'scheduler', actorDisplayName: 'Scheduler Worker', source: ActionSource.JOB };

export async function provisionMeetWorker([ job ]: Array<{ data: ProvisionMeetJob; retryCount?: number }>): Promise<void> {
  if (!job) return;
  const finalAttempt = (job.retryCount ?? 0) >= PROVISION_MEET_RETRY_LIMIT - 1;
  await runInAuditContext(JOB_CTX, () => provisionMeet(job.data.appointmentId, finalAttempt));
}
