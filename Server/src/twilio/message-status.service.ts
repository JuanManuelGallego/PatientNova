import { ReminderStatus } from '../../generated/prisma/client.ts';
import { prisma } from '../utils/prisma/prisma-client.js';
import { resolveTwilioError } from './twilio-errors.js';
import { TWILIO_TO_PRISMA_STATUS, statusRank } from './status-map.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { EntityType, ActionType, ActionSource } from '../../generated/prisma/enums.ts';
import { logger } from '../utils/api/logger.js';
import { sendReminderFailureAlert } from '../reminders/reminder-failure-alert.js';

export interface MessageStatusCallback {
  messageSid: string;
  messageStatus: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export enum DeliveryStatusOutcome {
  Updated = 'updated',
  NotFound = 'not-found',
  OutOfOrder = 'out-of-order',
  Unchanged = 'unchanged',
}

export interface DeliveryStatusActor {
  actorId: string;
  actorDisplayName: string;
}

const JOB_CTX: DeliveryStatusActor = { actorId: 'twilio-status-callback', actorDisplayName: 'Twilio Status Callback' };

export async function applyReminderDeliveryStatus(params: {
  messageId: string;
  mappedStatus: ReminderStatus;
  error: string | null;
  actor: DeliveryStatusActor;
  sourceLabel: string;
}): Promise<DeliveryStatusOutcome> {
  const { messageId, mappedStatus, actor, sourceLabel } = params;

  const reminder = await prisma.reminder.findFirst({
    where: { messageId, isDeleted: false },
    select: { id: true, status: true, userId: true, patient: true },
  });

  if (!reminder) {
    logger.debug({ messageId }, 'No active reminder for delivery status — ignoring');
    return DeliveryStatusOutcome.NotFound;
  }

  if (statusRank(mappedStatus) < statusRank(reminder.status)) {
    logger.debug(
      { messageId, from: reminder.status, to: mappedStatus },
      'Ignoring out-of-order status callback',
    );
    return DeliveryStatusOutcome.OutOfOrder;
  }

  if (mappedStatus === reminder.status) {
    return DeliveryStatusOutcome.Unchanged;
  }

  const error = mappedStatus === ReminderStatus.FAILED ? params.error : null;

  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { status: mappedStatus, error },
  });

  await runInAuditContext(actor, () =>
    logAudit({
      entityType: EntityType.REMINDER,
      entityId: reminder.id,
      actionType: ActionType.UPDATE,
      source: ActionSource.JOB,
      description: `Estado de entrega actualizado vía ${sourceLabel} para paciente ${reminder.patient?.name ?? ''} ${reminder.patient?.lastName ?? ''}`,
      affectedFields: ['status', 'error'],
      fieldsBefore: { status: reminder.status },
      fieldsAfter: { status: mappedStatus, error },
      userId: reminder.userId,
    }),
  );

  if (mappedStatus === ReminderStatus.FAILED) {
    await sendReminderFailureAlert(reminder.id);
  }

  logger.info({ messageId, reminderId: reminder.id, status: mappedStatus, actor: actor.actorId }, 'Reminder delivery status updated');
  return DeliveryStatusOutcome.Updated;
}

export async function processMessageStatusCallback(payload: MessageStatusCallback): Promise<void> {
  const { messageSid, messageStatus } = payload;

  if (!messageSid) {
    logger.debug('Status callback received without MessageSid — ignoring');
    return;
  }

  if (!messageStatus) {
    logger.debug({ messageSid }, 'Status callback received without MessageStatus — ignoring');
    return;
  }

  const mappedStatus = TWILIO_TO_PRISMA_STATUS[messageStatus.toLowerCase()] ?? ReminderStatus.QUEUED;
  if (mappedStatus === ReminderStatus.QUEUED) {
    return;
  }

  await applyReminderDeliveryStatus({
    messageId: messageSid,
    mappedStatus,
    error: resolveTwilioError(payload.errorCode ? Number(payload.errorCode) : null, payload.errorMessage ?? null),
    actor: JOB_CTX,
    sourceLabel: 'callback de Twilio',
  });
}
