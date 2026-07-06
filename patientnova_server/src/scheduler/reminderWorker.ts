import { Channel, ReminderStatus } from "../../generated/prisma/client.ts";
import { prisma } from "../prisma/prismaClient.js";
import { getMessageStatus } from "../twilio/twilioClient.js";
import { validateReminder } from "./validation.js";
import { dispatchMessage } from "./dispatch.js";
import { REMINDER_LOOKAHEAD_MS, REMINDER_BATCH_SIZE, REMINDER_POLL_CONCURRENCY } from "../utils/constants.ts";
import { logger } from "../utils/logger.ts";

export const MAX_TRACK_AGE_MS = 30 * 60 * 1000;
export const MAX_POLL_FAILURES = 5;
export const MAX_SEND_RETRIES = 3;
export const RETRY_DELAYS_MS = [ 2 * 60_000, 5 * 60_000, 15 * 60_000 ];

export const TWILIO_TO_PRISMA_STATUS: Partial<Record<string, ReminderStatus>> = {
  queued: ReminderStatus.QUEUED,
  sent: ReminderStatus.SENT,
  delivered: ReminderStatus.SENT,
  failed: ReminderStatus.FAILED,
  undelivered: ReminderStatus.FAILED,
};

/** Extract retry count from error field convention: "[retry N/3] ..." */
function getRetryCount(error: string | null): number {
  const match = error?.match(/^\[retry (\d+)\/\d+\]/);
  return match ? parseInt(match[ 1 ]!, 10) : 0;
}

/** Persist a retry or permanent failure for a reminder. */
async function handleSendFailure(reminderId: string, currentError: string | null, newError: string): Promise<void> {
  const retryCount = getRetryCount(currentError) + 1;

  if (retryCount <= MAX_SEND_RETRIES) {
    const delayMs = RETRY_DELAYS_MS[ retryCount - 1 ] ?? RETRY_DELAYS_MS.at(-1)!;
    logger.warn({ reminderId, retryCount, delayMs }, "Scheduling reminder retry");
    await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: ReminderStatus.PENDING,
        sendAt: new Date(Date.now() + delayMs),
        error: `[retry ${retryCount}/${MAX_SEND_RETRIES}] ${newError}`,
      },
    });
  } else {
    logger.error({ reminderId, error: newError }, "Reminder permanently failed after max retries");
    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: ReminderStatus.FAILED, error: newError },
    });
  }
}

// ---------------------------------------------------------------------------
// Poll previously-sent (QUEUED) reminders for delivery status
// Uses DB as source of truth — no in-memory state needed.
// ---------------------------------------------------------------------------

async function pollSentReminders(): Promise<void> {
  const cutoff = new Date(Date.now() - MAX_TRACK_AGE_MS);

  // Drop reminders that have been QUEUED too long — mark them failed
  const stale = await prisma.reminder.findMany({
    where: { status: ReminderStatus.QUEUED, updatedAt: { lte: cutoff } },
    select: { id: true },
    take: REMINDER_BATCH_SIZE,
  });

  if (stale.length > 0) {
    await prisma.reminder.updateMany({
      where: { id: { in: stale.map(r => r.id) } },
      data: {
        status: ReminderStatus.FAILED,
        error: "Status tracking timed out — message may have been delivered",
      },
    });
    logger.warn({ count: stale.length, reminderIds: stale.map(r => r.id) }, "Dropped stale QUEUED reminders");
  }

  // Poll active QUEUED reminders for their Twilio delivery status
  const queued = await prisma.reminder.findMany({
    where: { status: ReminderStatus.QUEUED, messageId: { not: null }, updatedAt: { gt: cutoff } },
    select: { id: true, messageId: true },
    take: REMINDER_BATCH_SIZE,
  });

  if (queued.length === 0) return;
  logger.info({ count: queued.length }, "Polling Twilio status for QUEUED reminders");

  // Process in parallel batches to avoid hammering Twilio API
  for (let i = 0; i < queued.length; i += REMINDER_POLL_CONCURRENCY) {
    const batch = queued.slice(i, i + REMINDER_POLL_CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (reminder) => {
        try {
          const message = await getMessageStatus(reminder.messageId!);
          const mappedStatus = TWILIO_TO_PRISMA_STATUS[ message.status ] ?? ReminderStatus.QUEUED;
          logger.info({ dbId: reminder.id, status: message.status, mappedStatus }, "Polled reminder status");

          if (mappedStatus !== ReminderStatus.QUEUED) {
            await prisma.reminder.update({
              where: { id: reminder.id },
              data: {
                status: mappedStatus,
                error: mappedStatus === ReminderStatus.FAILED
                  ? "Error desconocido en la entrega del mensaje"
                  : null,
              },
            });
          }
        } catch (error) {
          logger.error({ reminderId: reminder.id, error }, "Failed to poll reminder status");
          // Touch updatedAt so we can count poll failures via age-based staleness
        }
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Send pending reminders
// ---------------------------------------------------------------------------

async function sendPendingReminders(): Promise<void> {
  const lookahead = new Date(Date.now() + REMINDER_LOOKAHEAD_MS);
  const pending = await prisma.reminder.findMany({
    where: { status: ReminderStatus.PENDING, sendAt: { lte: lookahead } },
    take: REMINDER_BATCH_SIZE,
    // include: { appointment: { select: { meetingUrl: true } }, user: { select: { displayName: true } } },
  });

  if (pending.length === 0) {
    logger.debug("No reminders to send at this time");
    return;
  }

  logger.debug(`Found ${pending.length} reminder(s) to send`);

  for (const reminder of pending) {
    const validation = validateReminder(reminder);
    if (!validation.isValid) {
      logger.warn({ reminderId: reminder.id, channel: reminder.channel, to: reminder.to, appointmentId: reminder.appointmentId, error: validation.error }, "Reminder validation failed");
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: ReminderStatus.FAILED, error: validation.error ?? null },
      });
      continue;
    }

    try {
      const contentVariables = reminder.contentVariables as Record<string, string> | undefined;
      const result = await dispatchMessage(reminder.channel as Channel, {
        to: reminder.to!,
        body: reminder.body,
        contentSid: reminder.contentSid,
        contentVariables,
      });

      if (result.success) {
        logger.info({ reminderId: reminder.id, messageSid: result.messageSid }, "Reminder sent");
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: ReminderStatus.QUEUED, messageId: result.messageSid ?? null, sentAt: result.sentAt },
        });

        // if (reminder.appointment?.meetingUrl) {
        //   dispatchMessage(reminder.channel as Channel, {
        //     to: reminder.to!,
        //     body: `Aquí tienes el enlace para unirte a tu videoconsulta con ${reminder.user?.displayName ?? "tu profesional de la salud"}: ${reminder.appointment.meetingUrl}`,
        //     contentSid: config.twilio.appointmentMeetingLinkSid,
        //     contentVariables: { "1": reminder.user?.displayName ?? "tu profesional de la salud", "2": reminder.appointment.meetingUrl },
        //   })
        // }
      } else {
        await handleSendFailure(reminder.id, reminder.error, result.error ?? "Unknown error");
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      await handleSendFailure(reminder.id, reminder.error, errMsg);
    }
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function reminderWorker(): Promise<void> {
  logger.debug("Running reminder worker...");
  await pollSentReminders();
  await sendPendingReminders();
}
