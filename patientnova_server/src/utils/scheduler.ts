import cron from "node-cron";
import { ReminderStatus, Channel, type Reminder, AppointmentStatus, type Appointment } from "@prisma/client";
import { prisma } from "../prisma/prismaClient.js";
import { logger } from "./logger.js";
import { getMessageStatus, sendSms, sendWhatsApp } from "../twillo/twilioClient.js";
import { getLocalTimeParts, getTomorrowUTCRange } from "./timeUtils.js";

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

  if (reminder.channel === Channel.SMS || reminder.channel === Channel.EMAIL) {
    if (!reminder.body) {
      return {
        isValid: false,
        error: `Missing body for ${reminder.channel} message`,
      };
    }
  }

  return { isValid: true };
}

type TrackedReminder = { dbId: string; messageSid: string };

const twilioToPrismaStatus: Partial<Record<string, ReminderStatus>> = {
  queued: ReminderStatus.QUEUED,
  sent: ReminderStatus.SENT,
  delivered: ReminderStatus.SENT,
  failed: ReminderStatus.FAILED,
  undelivered: ReminderStatus.FAILED,
};

export async function reminderWorker(sentReminders: TrackedReminder[]): Promise<TrackedReminder[]> {
  let activeReminders: TrackedReminder[] = [];
  for (const sent of sentReminders) {
    try {
      const message = await getMessageStatus(sent.messageSid);
      const mappedStatus = twilioToPrismaStatus[ message.status ] ?? ReminderStatus.QUEUED;
      logger.info({ dbId: sent.dbId, messageSid: sent.messageSid, status: message.status, mappedStatus }, "Updating reminder status based on Twilio message status");

      if (mappedStatus !== ReminderStatus.QUEUED) {
        await prisma.reminder.update({ where: { id: sent.dbId }, data: { status: mappedStatus, error: mappedStatus === ReminderStatus.FAILED ? "Error desconocido en la entrega del mensaje" : null } });
      } else {
        activeReminders.push(sent);
      }
    } catch (error) {
      logger.error({ sent, error }, "Failed to update reminder status");
    }
  }

  try {
    logger.info("Running reminder scheduler worker...");
    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 60 * 950); // 950ms to account for processing time
    const remindersToSend = await prisma.reminder.findMany({
      where: {
        status: ReminderStatus.PENDING,
        sendAt: {
          lte: oneMinuteFromNow,
        },
      },
    });

    if (remindersToSend.length === 0) {
      logger.info("No reminders to send at this time");
      return activeReminders;
    }

    logger.info(`Found ${remindersToSend.length} reminder(s) to send`);

    for (const reminder of remindersToSend) {
      try {
        const validation = validateReminder(reminder);
        if (!validation.isValid) {
          logger.warn({ reminderId: reminder.id, channel: reminder.channel, error: validation.error, },
            `Reminder validation failed: ${validation.error}`
          );
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: ReminderStatus.FAILED, error: validation.error ?? null },
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
            result = await sendSms({
              to: reminder.to!,
              body: reminder.body!,
            });
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
          if (result.messageSid) activeReminders.push({ dbId: reminder.id, messageSid: result.messageSid });
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: ReminderStatus.QUEUED, messageId: result.messageSid ?? "" },
          });
        } else {
          logger.error({ reminderId: reminder.id, error: result.error }, "Failed to send reminder");
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: ReminderStatus.FAILED, error: result.error ?? null },
          });
        }
      } catch (error) {
        logger.error({ reminderId: reminder.id, error }, "Error processing reminder");
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: ReminderStatus.FAILED, error: error instanceof Error ? error.message : "Unknown error" },
        });
      }
    }
  } catch (error) {
    logger.error({ error }, "Error in reminder scheduler worker");
  }

  return activeReminders;
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
      }, startAt: {
        lte: lastHour,
      },
    },
    include: {
      patient: true,
    },
  });

  if (appointmentsToComplete.length === 0) logger.info("No appointments to complete at this time");

  for (const appointment of appointmentsToComplete) {
    try {
      await prisma.appointment.update({ where: { id: appointment.id }, data: { status: AppointmentStatus.COMPLETED, completedAt: now } })
      logger.info({ appointmentId: appointment.id }, "Appointment completed successfully")
    } catch (error) {
      logger.error({ appointmentId: appointment.id }, "Failed to update appointment status");
    }
  }
}

type AppointmentWithDetails = Appointment & {
  patient: { name: string; lastName: string };
  appointmentLocation: { name: string } | null;
};

function buildAppointmentsPayload(appointments: AppointmentWithDetails[], timezone: string): string {
  return appointments
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .map((appt) => {
      const timeStr = new Intl.DateTimeFormat("es-ES", {
        timeZone: timezone,
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(appt.startAt);
      const patientName = `${appt.patient.name} ${appt.patient.lastName}`;
      const location = appt.appointmentLocation?.name ?? "No location specified";
      return `• ${patientName} — ${timeStr} — ${location}`;
    })
    .join("\n");
}

export async function dailyReminderWorker(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { reminderActive: true, reminderChannel: { not: null } },
    select: { id: true, timezone: true, reminderChannel: true, email: true, whatsappNumber: true, phoneNumber: true },
  });

  for (const user of users) {
    try {
      const { hour, minute } = getLocalTimeParts(user.timezone);
      // Only trigger at exactly 6:00 PM in the user's timezone (cron runs every minute)
       if (hour !== 18 || minute !== 0) continue;

      const channel = user.reminderChannel!;
      const { start: tomorrowStart, end: tomorrowEnd } = getTomorrowUTCRange(user.timezone);

      const appointments = await prisma.appointment.findMany({
        where: {
          patient: { userId: user.id },
          startAt: { gte: tomorrowStart, lte: tomorrowEnd },
          status: { in: [ AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED ] },
        },
        include: {
          patient: true,
          appointmentLocation: true,
        },
      });

      if (appointments.length === 0) {
        logger.info({ userId: user.id }, "No tomorrow appointments to remind for user");
        continue;
      }

      logger.info({ userId: user.id, count: appointments.length }, "Creating daily reminders for tomorrow's appointments");

      let to: string | null = null;
      if (channel === Channel.WHATSAPP) to = user.whatsappNumber ?? null;
      else if (channel === Channel.SMS) to = user.phoneNumber ?? null;
      else if (channel === Channel.EMAIL) to = user.email ?? null;

      if (!to) {
        logger.warn({ userId: user.id, channel }, "User missing contact info for reminder channel, skipping");
        continue;
      }

      const payload = buildAppointmentsPayload(appointments, user.timezone);

      try {
        let result = null;
        if (channel === Channel.WHATSAPP) {
          logger.warn({ userId: user.id }, "EMAIL channel not yet implemented for daily reminders, skipping");
          continue;
        } else if (channel === Channel.SMS) {
          result = await sendSms({
            to,
            body: payload,
          });
        }
        else if (channel === Channel.EMAIL) {
          logger.warn({ userId: user.id }, "EMAIL channel not yet implemented for daily reminders, skipping");
          continue;
        }

        logger.info({ userId: user.id, channel }, "Daily reminder created");
      } catch (err) {
        logger.error({ userId: user.id, err }, "Failed to create daily reminder");
      }
    } catch (err) {
      logger.error({ userId: user.id, err }, "Error in daily reminder worker for user");
    }
  }
}

export function initializeSchedulers(): void {
  logger.info("Initializing reminder scheduler...");
  let sentReminders: TrackedReminder[] = [];
  schedulerTask = cron.schedule("* * * * *", async () => {
    sentReminders = await reminderWorker(sentReminders);
    await appointmentWorker();
    await dailyReminderWorker();
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

