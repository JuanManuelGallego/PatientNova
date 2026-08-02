import { ReminderStatus } from '../../../generated/prisma/client.ts';
import { prisma } from '../../utils/prisma/prisma-client.js';
import { getMessageStatus } from '../../twilio/client.js';
import { resolveTwilioError } from '../../twilio/twilio-errors.js';
import { REMINDER_BATCH_SIZE, REMINDER_POLL_CONCURRENCY } from '../../utils/config/constants.js';
import { logger } from '../../utils/api/logger.js';
import { logAudit } from '../../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../../audit-log/audit-log-context.js';
import { EntityType, ActionType, ActionSource } from '../../../generated/prisma/enums.ts';

const MAX_TRACK_AGE_MS = 30 * 60 * 1000;
const JOB_CTX = { actorId: 'scheduler', actorDisplayName: 'Scheduler Worker' };

const TWILIO_TO_PRISMA_STATUS: Partial<Record<string, ReminderStatus>> = {
  queued: ReminderStatus.QUEUED,
  sent: ReminderStatus.SENT,
  delivered: ReminderStatus.SENT,
  failed: ReminderStatus.FAILED,
  undelivered: ReminderStatus.FAILED,
};

export async function trackDeliveryWorker(): Promise<void> {
  const cutoff = new Date(Date.now() - MAX_TRACK_AGE_MS);

  const stale = await prisma.reminder.findMany({
    where: { status: ReminderStatus.QUEUED, updatedAt: { lte: cutoff }, isDeleted: false },
    select: { id: true },
    take: REMINDER_BATCH_SIZE,
  });

  if (stale.length > 0) {
    await prisma.reminder.updateMany({
      where: { id: { in: stale.map((r) => r.id) } },
      data: {
        status: ReminderStatus.FAILED,
        error: 'Status tracking timed out — message may have been delivered',
      },
    });
    await runInAuditContext(JOB_CTX, () => Promise.allSettled(
      stale.map(r => logAudit({
        entityType: EntityType.REMINDER,
        entityId: r.id,
        actionType: ActionType.UPDATE,
        source: ActionSource.JOB,
        description: `Recordatorio marcado como fallido (tiempo de espera agotado)`,
        affectedFields: ['status', 'error'],
        fieldsBefore: { status: ReminderStatus.QUEUED },
        fieldsAfter: { status: ReminderStatus.FAILED, error: 'Status tracking timed out' },
      }))
    ));
    logger.warn({ count: stale.length }, 'Dropped stale QUEUED reminders');
  }

  const queued = await prisma.reminder.findMany({
    where: {
      status: ReminderStatus.QUEUED,
      messageId: { not: null },
      updatedAt: { gt: cutoff },
      isDeleted: false,
    },
    select: { id: true, messageId: true },
    take: REMINDER_BATCH_SIZE,
  });

  if (queued.length === 0) return;
  logger.info({ count: queued.length }, 'Polling Twilio status for QUEUED reminders');

  for (let i = 0; i < queued.length; i += REMINDER_POLL_CONCURRENCY) {
    const batch = queued.slice(i, i + REMINDER_POLL_CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (reminder) => {
        try {
          const message = await getMessageStatus(reminder.messageId!);
          const mappedStatus = TWILIO_TO_PRISMA_STATUS[message.status] ?? ReminderStatus.QUEUED;

          if (mappedStatus !== ReminderStatus.QUEUED) {
            await prisma.reminder.update({
              where: { id: reminder.id },
              data: {
                status: mappedStatus,
                error: mappedStatus === ReminderStatus.FAILED
                  ? resolveTwilioError(message.errorCode, message.errorMessage)
                  : null,
              },
            });
            await runInAuditContext(JOB_CTX, () => logAudit({
              entityType: EntityType.REMINDER,
              entityId: reminder.id,
              actionType: ActionType.UPDATE,
              source: ActionSource.JOB,
              description: `Estado de entrega actualizado a ${mappedStatus}`,
              affectedFields: ['status', 'error'],
              fieldsBefore: { status: ReminderStatus.QUEUED },
              fieldsAfter: { status: mappedStatus, error: mappedStatus === ReminderStatus.FAILED ? message.errorMessage : null },
            }));
          }
        } catch (error) {
          logger.error({ reminderId: reminder.id, error }, 'Failed to poll reminder status');
        }
      })
    );
  }
}
