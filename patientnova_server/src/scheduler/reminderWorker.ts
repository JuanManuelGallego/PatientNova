import { Channel, ReminderStatus } from "../../generated/prisma/client.ts";
import { prisma } from "../prisma/prismaClient.js";
import { getMessageStatus } from "../twilio/twilioClient.js";
import { validateReminder } from "./validation.js";
import { dispatchMessage } from "./dispatch.js";
import { REMINDER_LOOKAHEAD_MS } from "../utils/constants.ts";
import { logger } from "../utils/logger.ts";
import type { TrackedReminder } from "../utils/types.ts";

export const MAX_TRACKED_REMINDERS = 500;
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
// Poll previously-sent reminders for delivery status
// ---------------------------------------------------------------------------

async function pollSentReminders(tracked: TrackedReminder[]): Promise<TrackedReminder[]> {
  const now = Date.now();
  const active: TrackedReminder[] = [];

  for (const sent of tracked) {
    const isStale = now - sent.trackedSince > MAX_TRACK_AGE_MS || sent.pollFailures >= MAX_POLL_FAILURES;

    if (isStale) {
      logger.warn(
        { dbId: sent.dbId, age: now - sent.trackedSince, pollFailures: sent.pollFailures },
        "Dropping stale tracked reminder"
      );
      await prisma.reminder
        .update({
          where: { id: sent.dbId },
          data: {
            status: ReminderStatus.FAILED,
            error: "Status tracking timed out — message may have been delivered",
          },
        })
        .catch((e) => logger.error({ e }, "Failed to mark stale reminder as failed"));
      continue;
    }

    try {
      const message = await getMessageStatus(sent.messageSid);
      const mappedStatus = TWILIO_TO_PRISMA_STATUS[ message.status ] ?? ReminderStatus.QUEUED;
      logger.info({ dbId: sent.dbId, status: message.status, mappedStatus }, "Polled reminder status");

      if (mappedStatus === ReminderStatus.QUEUED) {
        active.push(sent); // Still in-flight — keep tracking
      } else {
        await prisma.reminder.update({
          where: { id: sent.dbId },
          data: {
            status: mappedStatus,
            error: mappedStatus === ReminderStatus.FAILED
              ? "Error desconocido en la entrega del mensaje"
              : null,
          },
        });
      }
    } catch (error) {
      logger.error({ sent, error }, "Failed to poll reminder status");
      active.push({ ...sent, pollFailures: sent.pollFailures + 1 });
    }
  }

  return active;
}

// ---------------------------------------------------------------------------
// Send pending reminders
// ---------------------------------------------------------------------------

async function sendPendingReminders(active: TrackedReminder[]): Promise<TrackedReminder[]> {
  const lookahead = new Date(Date.now() + REMINDER_LOOKAHEAD_MS);
  const pending = await prisma.reminder.findMany({
    where: { status: ReminderStatus.PENDING, sendAt: { lte: lookahead } },
  });

  if (pending.length === 0) {
    logger.info("No reminders to send at this time");
    return active;
  }

  logger.info(`Found ${pending.length} reminder(s) to send`);

  for (const reminder of pending) {
    const validation = validateReminder(reminder);
    if (!validation.isValid) {
      logger.warn({ reminderId: reminder.id, error: validation.error }, "Reminder validation failed");
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
          data: { status: ReminderStatus.QUEUED, messageId: result.messageSid ?? null },
        });
        if (result.messageSid && active.length < MAX_TRACKED_REMINDERS) {
          active.push({
            dbId: reminder.id,
            messageSid: result.messageSid,
            trackedSince: Date.now(),
            pollFailures: 0,
          });
        }
      } else {
        await handleSendFailure(reminder.id, reminder.error, result.error ?? "Unknown error");
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      await handleSendFailure(reminder.id, reminder.error, errMsg);
    }
  }

  return active;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function reminderWorker(sentReminders: TrackedReminder[]): Promise<TrackedReminder[]> {
  logger.info("Running reminder worker...");
  const active = await pollSentReminders(sentReminders);
  return sendPendingReminders(active);
}
