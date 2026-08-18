import { ReminderStatus } from '../../generated/prisma/client.ts';
import { prisma } from '../utils/prisma/prisma-client.js';
import { resolveTwilioError } from './twilio-errors.js';
import { TWILIO_TO_PRISMA_STATUS, statusRank } from './status-map.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { EntityType, ActionType, ActionSource } from '../../generated/prisma/enums.ts';
import { logger } from '../utils/api/logger.js';

export interface MessageStatusCallback {
  messageSid: string;
  messageStatus: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}

const JOB_CTX = { actorId: 'twilio-status-callback', actorDisplayName: 'Twilio Status Callback' };

export async function processMessageStatusCallback(payload: MessageStatusCallback): Promise<void> {
  const { messageSid, messageStatus } = payload;

  const mappedStatus = TWILIO_TO_PRISMA_STATUS[messageStatus.toLowerCase()] ?? ReminderStatus.QUEUED;
  if (mappedStatus === ReminderStatus.QUEUED) {
    return;
  }

  const reminder = await prisma.reminder.findFirst({
    where: { messageId: messageSid, isDeleted: false },
    select: { id: true, status: true, userId: true, patient: true },
  });

  if (!reminder) {
    logger.debug({ messageSid }, 'No active reminder for status callback — ignoring');
    return;
  }

  if (statusRank(mappedStatus) < statusRank(reminder.status)) {
    logger.debug(
      { messageSid, from: reminder.status, to: mappedStatus },
      'Ignoring out-of-order status callback',
    );
    return;
  }

  if (mappedStatus === reminder.status) {
    return;
  }

  const error = mappedStatus === ReminderStatus.FAILED ? resolveTwilioError(payload.errorCode ? Number(payload.errorCode) : null, payload.errorMessage ?? null) : null;

  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { status: mappedStatus, error },
  });

  await runInAuditContext(JOB_CTX, () =>
    logAudit({
      entityType: EntityType.REMINDER,
      entityId: reminder.id,
      actionType: ActionType.UPDATE,
      source: ActionSource.JOB,
      description: `Estado de entrega actualizado vía callback de Twilio para paciente ${reminder.patient.name} ${reminder.patient.lastName}`,
      affectedFields: ['status', 'error'],
      fieldsBefore: { status: reminder.status },
      fieldsAfter: { status: mappedStatus, error },
      userId: reminder.userId,
    }),
  );

  logger.info({ messageSid, reminderId: reminder.id, status: mappedStatus }, 'Reminder status updated via Twilio callback');
}
