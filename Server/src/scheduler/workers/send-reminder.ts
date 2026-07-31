import { Channel, ReminderStatus } from '../../../generated/prisma/client.ts';
import { prisma } from '../../utils/prisma/prisma-client.js';
import { validateReminder } from '../validation.js';
import { dispatchMessage } from '../dispatch.js';
import { resolveTwilioError } from '../../twilio/twilio-errors.js';
import { REMINDER_SEND_RETRY_LIMIT } from '../../utils/config/constants.js';
import { logger } from '../../utils/api/logger.js';
import { auditLogService } from '../../audit-log/audit-log.service.js';
import { buildAuditEntry } from '../../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../../audit-log/audit-log-context.js';
import { EntityType, ActionType, ActionSource } from '../../../generated/prisma/enums.ts';

const JOB_CTX = { actorId: 'scheduler', actorDisplayName: 'Scheduler Worker' };

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
    await runInAuditContext(JOB_CTX, () => auditLogService.create(buildAuditEntry({
      entityType: EntityType.REMINDER,
      entityId: reminderId,
      actionType: ActionType.UPDATE,
      source: ActionSource.JOB,
      description: `Reminder failed validation: ${validation.error}`,
      affectedFields: ['status', 'error'],
      fieldsBefore: { status: reminder.status },
      fieldsAfter: { status: ReminderStatus.FAILED, error: validation.error },
    })));
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
    await runInAuditContext(JOB_CTX, () => auditLogService.create(buildAuditEntry({
      entityType: EntityType.REMINDER,
      entityId: reminderId,
      actionType: ActionType.UPDATE,
      source: ActionSource.JOB,
      description: `Reminder dispatched and queued`,
      affectedFields: ['status', 'messageId', 'sentAt'],
      fieldsBefore: { status: reminder.status },
      fieldsAfter: { status: ReminderStatus.QUEUED, messageId: result.messageSid },
    })));
  } else {
    if ((job.retryCount ?? 0) >= REMINDER_SEND_RETRY_LIMIT - 1) {
      await prisma.reminder.update({
        where: { id: reminderId },
        data: {
          status: ReminderStatus.FAILED,
          error: resolveTwilioError(result.errorCode, result.error ?? 'Dispatch failed'),
        },
      });
      await runInAuditContext(JOB_CTX, () => auditLogService.create(buildAuditEntry({
        entityType: EntityType.REMINDER,
        entityId: reminderId,
        actionType: ActionType.UPDATE,
        source: ActionSource.JOB,
        description: `Reminder permanently failed after max retries`,
        affectedFields: ['status', 'error'],
        fieldsBefore: { status: reminder.status },
        fieldsAfter: { status: ReminderStatus.FAILED, error: result.error },
      })));
      logger.error({ reminderId, error: result.error }, 'Reminder permanently failed after max retries');
    }

    throw new Error(result.error ?? 'Dispatch failed');
  }
}
