import { Channel } from '../../generated/prisma/client.ts';
import { dispatchMessage } from '../scheduler/dispatch.js';
import { prisma } from '../utils/prisma/prisma-client.js';
import { config } from '../utils/config/config.ts';
import { logger } from '../utils/api/logger.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { EntityType, ActionType, ActionSource } from '../../generated/prisma/enums.ts';

const ALERT_AUDIT_CONTEXT = {
  actorId: 'reminder-failure-alert',
  actorDisplayName: 'Reminder Failure Alert',
};

type AlertAuditStatus = 'SENT' | 'FAILED' | 'SKIPPED';

async function logAlertAudit(params: {
  reminderId: string;
  userId: string;
  channel: Channel;
  status: AlertAuditStatus;
  messageId?: string;
  error?: string;
  reason?: string;
}): Promise<void> {
  const { reminderId, userId, channel, status, messageId, error, reason } = params;
  const description = status === 'SENT'
    ? `Alerta de fallo del recordatorio enviada por ${channel}`
    : status === 'FAILED'
      ? `Alerta de fallo del recordatorio falló por ${channel}`
      : `Alerta de fallo del recordatorio omitida: ${reason}`;

  try {
    await runInAuditContext(ALERT_AUDIT_CONTEXT, () => logAudit({
      entityType: EntityType.REMINDER,
      entityId: reminderId,
      actionType: ActionType.UPDATE,
      source: ActionSource.JOB,
      description,
      affectedFields: [
        'failureAlertStatus',
        'failureAlertChannel',
        ...(messageId ? [ 'failureAlertMessageId' ] : []),
        ...(error ? [ 'failureAlertError' ] : []),
        ...(reason ? [ 'failureAlertReason' ] : []),
      ],
      fieldsAfter: {
        failureAlertStatus: status,
        failureAlertChannel: channel,
        ...(messageId ? { failureAlertMessageId: messageId } : {}),
        ...(error ? { failureAlertError: error } : {}),
        ...(reason ? { failureAlertReason: reason } : {}),
      },
      userId,
    }));
  } catch (auditError) {
    // An audit outage must not turn a best-effort alert into a hard failure.
    logger.error({ reminderId, userId, auditError }, 'Failed to log reminder failure alert audit event');
  }
}

function fullName(firstName: string | null, lastName: string | null): string {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim();
}

/**
 * Sends a best-effort alert to the reminder owner without creating another
 * Reminder record, which prevents an alert failure from becoming recursive.
 */
export async function sendReminderFailureAlert(reminderId: string): Promise<void> {
  let auditDetails: { userId: string; channel: Channel } | undefined;

  try {
    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      select: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            reminderActive: true,
            reminderChannel: true,
            whatsappNumber: true,
            phoneNumber: true,
          },
        },
        patient: {
          select: { name: true, lastName: true },
        },
      },
    });

    if (!reminder) {
      logger.warn({ reminderId }, 'Reminder failure alert skipped — reminder not found');
      return;
    }

    const { user, patient } = reminder;
    auditDetails = { userId: user.id, channel: user.reminderChannel };
    if (!user.reminderActive) {
      await logAlertAudit({
        reminderId,
        ...auditDetails,
        status: 'SKIPPED',
        reason: 'user_alerts_disabled',
      });
      logger.debug({ reminderId, userId: user.id }, 'Reminder failure alert skipped — user alerts disabled');
      return;
    }

    const userName = user.displayName?.trim() || fullName(user.firstName, user.lastName);
    const patientName = fullName(patient.name, patient.lastName);
    const isWhatsApp = user.reminderChannel === Channel.WHATSAPP;
    const to = isWhatsApp ? user.whatsappNumber : user.phoneNumber;

    if (!to) {
      await logAlertAudit({
        reminderId,
        ...auditDetails,
        status: 'SKIPPED',
        reason: 'contact_number_missing',
      });
      logger.warn(
        { reminderId, userId: user.id, channel: user.reminderChannel },
        'Reminder failure alert skipped — user has no contact number for channel',
      );
      return;
    }

    let result;
    try {
      result = await dispatchMessage(user.reminderChannel, isWhatsApp
        ? {
            to,
            contentSid: config.twilio.reminderFailedSid,
            contentVariables: { '1': userName, '2': patientName },
          }
        : {
            to,
            body: `Hola, ${userName}.\n\nLe informamos que el recordatorio del paciente ${patientName} falló. Por favor, verifique la información en el sistema.\n\nFeliz día`,
          });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Alert dispatch threw';
      await logAlertAudit({
        reminderId,
        ...auditDetails,
        status: 'FAILED',
        error: errorMessage,
      });
      throw error;
    }

    if (!result.success) {
      await logAlertAudit({
        reminderId,
        ...auditDetails,
        status: 'FAILED',
        error: result.error ?? 'Dispatch failed',
      });
      logger.error(
        { reminderId, userId: user.id, channel: user.reminderChannel, error: result.error },
        'Reminder failure alert was not sent',
      );
      return;
    }

    await logAlertAudit({
      reminderId,
      ...auditDetails,
      status: 'SENT',
      ...(result.messageSid ? { messageId: result.messageSid } : {}),
    });

    logger.info(
      { reminderId, userId: user.id, channel: user.reminderChannel, messageId: result.messageSid },
      'Reminder failure alert sent',
    );
  } catch (error) {
    logger.error({ reminderId, error }, 'Reminder failure alert could not be sent');
  }
}
