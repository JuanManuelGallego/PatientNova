import { ReminderStatus } from '../../generated/prisma/client.ts';
import { logger } from '../utils/api/logger.js';
import { applyReminderDeliveryStatus, type DeliveryStatusActor } from './message-status.service.js';

/** Subset of a Brevo transactional webhook event we care about. */
export interface BrevoEvent {
  event?: string;
  email?: string;
  /** Same value returned as `messageId` by POST /smtp/email, e.g. "<2026...@smtp-relay.mailin.fr>". */
  'message-id'?: string;
  reason?: string;
  ts_event?: number;
}

/**
 * Brevo event → ReminderStatus. Events not listed here (request, deferred,
 * soft_bounce — Brevo retries those — opened, click, spam, unsubscribed, ...)
 * are informational and leave the reminder unchanged.
 */
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

      // 'not-found' usually means the stored messageId format differs from Brevo's "message-id".
      const log = outcome === 'not-found' ? logger.warn.bind(logger) : logger.info.bind(logger);
      log({ messageId, event: event.event, mappedStatus, outcome }, 'Brevo event processed');
    } catch (err) {
      // One bad event must not stop the rest of the batch.
      logger.error({ err, messageId, event: event?.event }, 'Failed to process Brevo event');
    }
  }
}
