import cron from "node-cron";
import { ReminderStatus, Channel, type Reminder, AppointmentStatus } from "@prisma/client";
import { prisma } from "../prisma/prismaClient.js";
import { logger } from "./logger.js";
import { sendWhatsApp } from "../twillo/twilioClient.js";
import { reminderRepository } from "../reminders/reminder.repository.js";
import { appointmentRepository } from "../appointments/appointment.repository.js";

let schedulerTask: cron.ScheduledTask | null = null;

function validateReminder(reminder: Reminder): { isValid: boolean; error?: string; } {
  if (!reminder.channel) {
    return {
      isValid: false,
      error: "Missing channel for reminder",
    };
  }
  if (!reminder.to) {
    return {
      isValid: false,
      error: `No recipient available for channel ${reminder.channel}`,
    };
  }

  if (reminder.channel === Channel.WHATSAPP) {
    if (!reminder.contentSid) {
      return {
        isValid: false,
        error: "Missing contentSid for WhatsApp message",
      };
    }

    if (
      reminder.contentVariables &&
      (typeof reminder.contentVariables !== "object" ||
        reminder.contentVariables === null)
    ) {
      return { isValid: false, error: "Invalid contentVariables format" };
    }
  }

  return { isValid: true };
}

export async function reminderWorker(): Promise<void> {
  try {
    logger.info("Running reminder scheduler worker...");
    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);
    const remindersToSend = await prisma.reminder.findMany({
      where: {
        status: ReminderStatus.PENDING,
        scheduledAt: {
          lte: oneMinuteFromNow,
        },
      },
      include: {
        patient: true,
      },
    });

    if (remindersToSend.length === 0) {
      logger.info("No reminders to send at this time");
      return;
    }

    logger.info(`Found ${remindersToSend.length} reminder(s) to send`);

    for (const reminder of remindersToSend) {
      try {
        const validation = validateReminder(reminder);
        if (!validation.isValid) {
          logger.warn({ reminderId: reminder.id, channel: reminder.channel, error: validation.error, },
            `Reminder validation failed: ${validation.error}`
          );
          await reminderRepository.update(reminder.id, {
            status: ReminderStatus.FAILED,
            error: validation.error,
          });
          continue;
        }

        const contentVariables = reminder.contentVariables as Record<string, string>;

        let result;
        switch (reminder.channel) {
          case Channel.WHATSAPP:
            result = await sendWhatsApp({
              to: reminder.to!,
              contentSid: reminder.contentSid!,
              ...(contentVariables && { contentVariables }),
            });
            break;

          case Channel.SMS:
            result = {
              success: false,
              error: "SMS channel not yet implemented",
              messageSid: null,
            };
            break;

          case Channel.EMAIL:
            result = {
              success: false,
              error: "EMAIL channel not yet implemented",
              messageSid: null,
            };
            break;

          default:
            result = {
              success: false,
              error: "Channel not supported",
              messageSid: null,
            };
        }

        if (result.success) {
          logger.info({ reminderId: reminder.id, messageSid: result.messageSid }, "Reminder sent successfully");
          await reminderRepository.update(reminder.id, {
            status: ReminderStatus.SENT,
            sentAt: new Date().toISOString(),
            messageId: result.messageSid ?? "",
          });
        } else {
          logger.error({ reminderId: reminder.id, error: result.error }, "Failed to send reminder");
          await reminderRepository.update(reminder.id, {
            status: ReminderStatus.FAILED,
            error: result.error,
          });
        }
      } catch (error) {
        logger.error({ reminderId: reminder.id, error }, "Error processing reminder");
        try {
          await reminderRepository.update(reminder.id, {
            status: ReminderStatus.FAILED,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        } catch (updateError) {
          logger.error({ reminderId: reminder.id, updateError }, "Failed to update reminder status");
        }
      }
    }
  } catch (error) {
    logger.error({ error }, "Error in reminder scheduler worker");
  }
}

export async function appointmentWorker(): Promise<void> {
  logger.info("Running appointment worker...");
  const now = new Date();
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
  const appointmentsToComplete = await prisma.appointment.findMany({
    where: {
      status: {
        in: [
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.SCHEDULED,
        ],
      }, date: {
        lte: lastHour,
      },
    },
    include: {
      patient: true,
    },
  });

  if (appointmentsToComplete.length == 0) logger.info("No appointments to complete at this time")

  for (const appointment of appointmentsToComplete) {
    try {
      appointmentRepository.update(appointment.id, { status: AppointmentStatus.COMPLETED })
      logger.info({ appointmentId: appointment.id }, "Appointment completed successfully")
    } catch (error) {
      logger.error({ appointmentId: appointment.id }, "Failed to update appointment status");
    }
  }
}

export function initializeSchedulers(): void {
  logger.info("Initializing reminder scheduler...");

  schedulerTask = cron.schedule("* * * * *", async () => { // */5 * * * *
    await reminderWorker();
    await appointmentWorker();
  });

  logger.info("Schedulers initialized - running every minute");
}

export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask.destroy();
    schedulerTask = null;
    logger.info("Reminder scheduler stopped");
  }
}
