import { Channel, ReminderStatus } from '../../../generated/prisma/client.ts';
import { prisma } from '../../utils/prisma/prisma-client.js';
import { validateReminder } from '../validation.js';
import { dispatchMessage } from '../dispatch.js';
import { resolveTwilioError } from '../../twilio/twilio-errors.js';
import { REMINDER_SEND_RETRY_LIMIT } from '../../utils/config/constants.js';
import { logger } from '../../utils/api/logger.js';
import { logAudit } from '../../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../../audit-log/audit-log-context.js';
import { EntityType, ActionType, ActionSource } from '../../../generated/prisma/enums.ts';

const JOB_CTX = { actorId: 'bulk-send-worker', actorDisplayName: 'Bulk Send Worker' };

export async function bulkSendWorker([job]: Array<{
  data: { reminderId: string };
  retryCount?: number;
}>): Promise<void> {
  if (!job) return;
  const { reminderId } = job.data;

  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!reminder) {
    logger.warn({ reminderId }, 'Bulk send reminder not found — skipping');
    return;
  }

  if (reminder.status !== ReminderStatus.PENDING || reminder.isDeleted) {
    logger.debug({ reminderId, status: reminder.status }, 'Bulk send reminder no longer pending — skipping');
    return;
  }

  // Belt-and-braces: a scheduled reminder must never dispatch before its
  // requested sendAt (pg-boss startAfter normally handles this).
  if (new Date(reminder.sendAt) > new Date()) {
    logger.debug({ reminderId, sendAt: reminder.sendAt }, 'Bulk send reminder scheduled in the future — skipping');
    return;
  }

  const validation = validateReminder(reminder);
  if (!validation.isValid) {
    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: ReminderStatus.FAILED, error: validation.error ?? null },
    });
    await runInAuditContext(JOB_CTX, () => logAudit({
      entityType: EntityType.REMINDER,
      entityId: reminderId,
      actionType: ActionType.UPDATE,
      source: ActionSource.JOB,
      description: `Envío masivo falló validación: ${validation.error}`,
      affectedFields: ['status', 'error'],
      fieldsBefore: { status: reminder.status },
      fieldsAfter: { status: ReminderStatus.FAILED, error: validation.error },
    }));
    return;
  }

  const contentVariables = reminder.contentVariables as Record<string, string> | undefined;
  let result;
  try {
    result = await dispatchMessage(reminder.channel as Channel, {
      to: reminder.to,
      body: reminder.body,
      contentSid: reminder.contentSid,
      contentVariables,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Dispatch threw';
    if ((job.retryCount ?? 0) >= REMINDER_SEND_RETRY_LIMIT - 1) {
      await prisma.reminder.update({
        where: { id: reminderId },
        data: { status: ReminderStatus.FAILED, error: errorMsg },
      });
      await runInAuditContext(JOB_CTX, () => logAudit({
        entityType: EntityType.REMINDER,
        entityId: reminderId,
        actionType: ActionType.UPDATE,
        source: ActionSource.JOB,
        description: `Envío masivo falló permanentemente después del máximo de reintentos`,
        affectedFields: ['status', 'error'],
        fieldsBefore: { status: reminder.status },
        fieldsAfter: { status: ReminderStatus.FAILED, error: errorMsg },
      }));
      logger.error({ reminderId, error: errorMsg }, 'Bulk send reminder permanently failed after max retries');
    } else {
      throw err;
    }
    return;
  }

  if (result.success) {
    await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: ReminderStatus.QUEUED,
        messageId: result.messageSid ?? null,
        sentAt: result.sentAt ?? null,
      },
    });
    await runInAuditContext(JOB_CTX, () => logAudit({
      entityType: EntityType.REMINDER,
      entityId: reminderId,
      actionType: ActionType.UPDATE,
      source: ActionSource.JOB,
      description: `Envío masivo despachado y encolado`,
      affectedFields: ['status', 'messageId', 'sentAt'],
      fieldsBefore: { status: reminder.status },
      fieldsAfter: { status: ReminderStatus.QUEUED, messageId: result.messageSid },
    }));
  } else {
    if ((job.retryCount ?? 0) >= REMINDER_SEND_RETRY_LIMIT - 1) {
      await prisma.reminder.update({
        where: { id: reminderId },
        data: {
          status: ReminderStatus.FAILED,
          error: resolveTwilioError(result.errorCode, result.error ?? 'Dispatch failed'),
        },
      });
      await runInAuditContext(JOB_CTX, () => logAudit({
        entityType: EntityType.REMINDER,
        entityId: reminderId,
        actionType: ActionType.UPDATE,
        source: ActionSource.JOB,
        description: `Envío masivo falló permanentemente después del máximo de reintentos`,
        affectedFields: ['status', 'error'],
        fieldsBefore: { status: reminder.status },
        fieldsAfter: { status: ReminderStatus.FAILED, error: result.error },
      }));
      logger.error({ reminderId, error: result.error }, 'Bulk send reminder permanently failed after max retries');
    } else {
      // Not the final attempt: rethrow so pg-boss retries the job.
      throw new Error(result.error ?? 'Dispatch failed');
    }
  }
}
