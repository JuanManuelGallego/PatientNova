import { ActionSource, ActionType, EntityType, ReminderStatus } from '../../generated/prisma/enums.js';
import { prisma } from '../utils/prisma/prisma-client.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext, type AuditContext } from '../audit-log/audit-log-context.js';

/** Settles a queued reminder as CANCELLED, so a skipped job does not leave it PENDING forever. */
export async function cancelQueuedReminder(
  reminder: { id: string; userId: string },
  description: string,
  auditContext: AuditContext,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.reminder.updateMany({
      where: { id: reminder.id, status: ReminderStatus.PENDING },
      data: { status: ReminderStatus.CANCELLED },
    });
    if (count === 0) return;
    await runInAuditContext(auditContext, () => logAudit({
      entityType: EntityType.REMINDER,
      entityId: reminder.id,
      actionType: ActionType.UPDATE,
      source: ActionSource.JOB,
      description,
      affectedFields: [ 'status' ],
      fieldsBefore: { status: ReminderStatus.PENDING },
      fieldsAfter: { status: ReminderStatus.CANCELLED },
      userId: reminder.userId,
      tx,
      required: true,
    }));
  });
}
