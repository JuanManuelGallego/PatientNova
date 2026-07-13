import { Channel, ReminderStatus } from '../../../generated/prisma/client.ts';
import { prisma } from '../../prisma/prismaClient.js';
import { validateReminder } from '../validation.js';
import { dispatchMessage } from '../dispatch.js';
import { logger } from '../../utils/logger.js';

const RETRY_LIMIT = 3;

// pg-boss work() handlers receive an array of jobs.
export async function sendReminderWorker([job]: Array<{
  data: { reminderId: string };
  retryCount?: number;
}>): Promise<void> {
  if (!job) return;
  const { reminderId } = job.data;

  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!reminder) {
    logger.warn({ reminderId }, 'Reminder not found — skipping');
    return;
  }

  if (reminder.status !== ReminderStatus.PENDING || reminder.isDeleted) {
    logger.debug({ reminderId, status: reminder.status }, 'Reminder no longer pending — skipping');
    return;
  }

  const validation = validateReminder(reminder);
  if (!validation.isValid) {
    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: ReminderStatus.FAILED, error: validation.error ?? null },
    });
    return;
  }

  const contentVariables = reminder.contentVariables as Record<string, string> | undefined;
  const result = await dispatchMessage(reminder.channel as Channel, {
    to: reminder.to,
    body: reminder.body,
    contentSid: reminder.contentSid,
    contentVariables,
  });

  if (result.success) {
    await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: ReminderStatus.QUEUED,
        messageId: result.messageSid ?? null,
        sentAt: result.sentAt ?? null,
      },
    });
  } else {
    // On final retry, mark the reminder FAILED before throwing so pg-boss dead-letters it.
    if ((job.retryCount ?? 0) >= RETRY_LIMIT - 1) {
      await prisma.reminder.update({
        where: { id: reminderId },
        data: { status: ReminderStatus.FAILED, error: result.error ?? 'Dispatch failed' },
      });
      logger.error({ reminderId, error: result.error }, 'Reminder permanently failed after max retries');
    }
    // Throw to let pg-boss handle retry or dead-letter.
    throw new Error(result.error ?? 'Dispatch failed');
  }
}
