import { ReminderStatus } from '../../generated/prisma/client.ts';
import { logger } from '../utils/api/logger.js';
import { applyReminderDeliveryStatus, DeliveryStatusOutcome, type DeliveryStatusActor } from '../twilio/message-status.service.js';

export interface BrevoEvent {
  event?: string;
  email?: string;
  'message-id'?: string;
  reason?: string;
  ts_event?: number;
}

export const BREVO_TO_PRISMA_STATUS: Partial<Record<string, ReminderStatus>> = {
  delivered: ReminderStatus.SENT,
  hard_bounce: ReminderStatus.FAILED,
  blocked: ReminderStatus.FAILED,
  invalid_email: ReminderStatus.FAILED,
  error: ReminderStatus.FAILED,
};

const JOB_CTX: DeliveryStatusActor = { actorId: 'brevo-webhook', actorDisplayName: 'Brevo Webhook' };

function describeFailure(event: BrevoEvent): string {
  return event.reason ? `Email ${event.event}: ${event.reason}` : `Email ${event.event}`;
}

export async function processBrevoEvents(events: BrevoEvent[]): Promise<void> {
  for (const event of events) {
    const messageId = event?.[ 'message-id' ];
    try {
      if (!messageId || !event?.event) {
        logger.warn(
          { event: event?.event, hasMessageId: Boolean(messageId), keys: Object.keys(event ?? {}) },
          'Brevo event without message-id/event — ignoring',
        );
        continue;
      }

      const mappedStatus = BREVO_TO_PRISMA_STATUS[ event.event.toLowerCase() ];
      if (!mappedStatus) {
        logger.info({ messageId, event: event.event }, 'Brevo event not tracked — ignoring');
        continue;
      }

      const outcome = await applyReminderDeliveryStatus({
        messageId,
        mappedStatus,
        error: mappedStatus === ReminderStatus.FAILED ? describeFailure(event) : null,
        actor: JOB_CTX,
        sourceLabel: 'webhook de Brevo',
      });

      const log = outcome === DeliveryStatusOutcome.NotFound ? logger.warn.bind(logger) : logger.info.bind(logger);
      log({ messageId, event: event.event, mappedStatus, outcome }, 'Brevo event processed');
    } catch (err) {
      logger.error({ err, messageId, event: event?.event }, 'Failed to process Brevo event');
    }
  }
}
