import { ReminderStatus } from '../../../generated/prisma/client.ts';
import { prisma } from '../../prisma/prismaClient.js';
import { getMessageStatus } from '../../twilio/twilioClient.js';
import { REMINDER_BATCH_SIZE, REMINDER_POLL_CONCURRENCY } from '../../utils/constants.js';
import { logger } from '../../utils/logger.js';

const MAX_TRACK_AGE_MS = 30 * 60 * 1000;

const TWILIO_TO_PRISMA_STATUS: Partial<Record<string, ReminderStatus>> = {
  queued: ReminderStatus.QUEUED,
  sent: ReminderStatus.SENT,
  delivered: ReminderStatus.SENT,
  failed: ReminderStatus.FAILED,
  undelivered: ReminderStatus.FAILED,
};

/**
 * Polls Twilio for the delivery status of QUEUED reminders. Runs on the
 * `track-delivery` pg-boss schedule (every 5 minutes). Ignores the schedule
 * job payload and queries the DB directly (idempotent across overlapping runs).
 */
export async function trackDeliveryWorker(): Promise<void> {
  const cutoff = new Date(Date.now() - MAX_TRACK_AGE_MS);

  // Drop reminders that have been QUEUED too long — mark them failed.
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
    logger.warn({ count: stale.length }, 'Dropped stale QUEUED reminders');
  }

  // Poll active QUEUED reminders for their Twilio delivery status.
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
                  ? 'Error desconocido en la entrega del mensaje'
                  : null,
              },
            });
          }
        } catch (error) {
          logger.error({ reminderId: reminder.id, error }, 'Failed to poll reminder status');
        }
      })
    );
  }
}
