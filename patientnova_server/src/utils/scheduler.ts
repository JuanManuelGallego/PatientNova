import cron from "node-cron";
import { ReminderStatus, Channel, type Reminder, AppointmentStatus, type Appointment } from '../../generated/prisma/client.ts';
import { prisma } from "../prisma/prismaClient.js";
import { logger } from "./logger.js";
import { getMessageStatus, sendSms, sendWhatsApp } from "../twilio/twilioClient.js";
import { getLocalTimeParts, getTomorrowUTCRange } from "./timeUtils.js";
import { APPT_SID_MAP, config } from "./config.js";
import { ONE_HOUR_MS, ONE_DAY_MS, REMINDER_LOOKAHEAD_MS, DAILY_REMINDER_HOUR, DEFAULT_LOCALE } from "./constants.js";

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

type TrackedReminder = { dbId: string; messageSid: string; trackedSince: number; pollFailures: number };

const MAX_TRACKED_REMINDERS = 500;
const MAX_TRACK_AGE_MS = 30 * 60 * 1000; // 30 minutes
const MAX_POLL_FAILURES = 5;
const MAX_SEND_RETRIES = 3;
const RETRY_DELAYS_MS = [ 2 * 60_000, 5 * 60_000, 15 * 60_000 ]; // 2min, 5min, 15min

/** Extract retry count from error field convention: "[retry N/3] ..." */
function getRetryCount(error: string | null): number {
  const match = error?.match(/^\[retry (\d+)\/\d+\]/);
  return match ? parseInt(match[ 1 ]!, 10) : 0;
}

const twilioToPrismaStatus: Partial<Record<string, ReminderStatus>> = {
  queued: ReminderStatus.QUEUED,
  sent: ReminderStatus.SENT,
  delivered: ReminderStatus.SENT,
  failed: ReminderStatus.FAILED,
  undelivered: ReminderStatus.FAILED,
};

export async function reminderWorker(sentReminders: TrackedReminder[]): Promise<TrackedReminder[]> {
  let activeReminders: TrackedReminder[] = [];
  const now = Date.now();

  for (const sent of sentReminders) {
    // Drop entries that have been tracked too long or failed too many polls
    if (now - sent.trackedSince > MAX_TRACK_AGE_MS || sent.pollFailures >= MAX_POLL_FAILURES) {
      logger.warn({ dbId: sent.dbId, messageSid: sent.messageSid, age: now - sent.trackedSince, pollFailures: sent.pollFailures }, "Dropping stale tracked reminder");
      await prisma.reminder.update({ where: { id: sent.dbId }, data: { status: ReminderStatus.FAILED, error: "Status tracking timed out — message may have been delivered" } }).catch(e => logger.error({ e }, "Failed to mark stale reminder"));
      continue;
    }

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
      // Keep tracking but increment failure count instead of silently dropping
      activeReminders.push({ ...sent, pollFailures: sent.pollFailures + 1 });
    }
  }

  try {
    logger.info("Running reminder scheduler worker...");
    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + REMINDER_LOOKAHEAD_MS);
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
            logger.warn({ reminderId: reminder.id }, "EMAIL channel is not yet implemented — marking as failed");
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
          if (result.messageSid && activeReminders.length < MAX_TRACKED_REMINDERS) {
            activeReminders.push({ dbId: reminder.id, messageSid: result.messageSid, trackedSince: Date.now(), pollFailures: 0 });
          }
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: ReminderStatus.QUEUED, messageId: result.messageSid ?? null },
          });
        } else {
          const retryCount = getRetryCount(reminder.error) + 1;
          if (retryCount <= MAX_SEND_RETRIES) {
            const delayMs = RETRY_DELAYS_MS[ retryCount - 1 ] ?? RETRY_DELAYS_MS[ RETRY_DELAYS_MS.length - 1 ]!;
            logger.warn({ reminderId: reminder.id, retryCount, delayMs }, "Retrying failed reminder");
            await prisma.reminder.update({
              where: { id: reminder.id },
              data: { status: ReminderStatus.PENDING, sendAt: new Date(Date.now() + delayMs), error: `[retry ${retryCount}/${MAX_SEND_RETRIES}] ${result.error ?? 'Unknown'}` },
            });
          } else {
            logger.error({ reminderId: reminder.id, error: result.error }, "Reminder permanently failed after retries");
            await prisma.reminder.update({
              where: { id: reminder.id },
              data: { status: ReminderStatus.FAILED, error: result.error ?? null },
            });
          }
        }
      } catch (error) {
        const retryCount = getRetryCount(reminder.error) + 1;
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        if (retryCount <= MAX_SEND_RETRIES) {
          const delayMs = RETRY_DELAYS_MS[ retryCount - 1 ] ?? RETRY_DELAYS_MS[ RETRY_DELAYS_MS.length - 1 ]!;
          logger.warn({ reminderId: reminder.id, retryCount, delayMs }, "Retrying failed reminder (exception)");
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: ReminderStatus.PENDING, sendAt: new Date(Date.now() + delayMs), error: `[retry ${retryCount}/${MAX_SEND_RETRIES}] ${errMsg}` },
          });
        } else {
          logger.error({ reminderId: reminder.id, error }, "Reminder permanently failed after retries");
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: ReminderStatus.FAILED, error: errMsg },
          });
        }
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
  const lastHour = new Date(now.getTime() - ONE_HOUR_MS);
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
      logger.error({ appointmentId: appointment.id, error }, "Failed to update appointment status");
    }
  }
}

type AppointmentWithDetails = Appointment & {
  patient: { name: string; lastName: string };
  appointmentLocation: { name: string } | null;
};

function buildAppointmentsPayload(appointments: AppointmentWithDetails[], timezone: string): string[] {
  const dateFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const formatAppointment = (appt: AppointmentWithDetails): string => {
    const timeStr = dateFormatter.format(appt.startAt);
    const patientName = `${appt.patient.name} ${appt.patient.lastName}`;
    const location = appt.appointmentLocation?.name ?? "No location specified";
    return `• ${patientName} — ${timeStr} — ${location}`;
  };

  const sortByTime = (a: AppointmentWithDetails, b: AppointmentWithDetails) =>
    a.startAt.getTime() - b.startAt.getTime();

  return appointments.sort(sortByTime).map(formatAppointment);
}

function buildWhatsAppContent(
  userName: string,
  tomorrowDate: string,
  payload: string[]
): { contentSid: string; contentVariables: Record<string, string> } {
  const contentSid = APPT_SID_MAP[ payload.length ] ?? config.twilio.tomorrowAppointmentsReminderSid;
  const baseVariables = { "1": userName, "2": tomorrowDate };

  const contentVariables = APPT_SID_MAP[ payload.length ]
    ? payload.reduce(
      (acc, item, i) => ({ ...acc, [ String(i + 3) ]: item || "N/A" }),
      baseVariables
    )
    : { ...baseVariables, "3": payload.join(" | ") };

  return { contentSid, contentVariables };
}

export async function dailyReminderWorker(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { reminderActive: true, reminderChannel: { not: null } },
    select: { id: true, timezone: true, reminderChannel: true, email: true, whatsappNumber: true, phoneNumber: true, firstName: true, lastName: true, displayName: true },
  });

  for (const user of users) {
    try {
      const { hour, minute } = getLocalTimeParts(user.timezone);
      // Only trigger at exactly 6:00 PM in the user's timezone (cron runs every minute)
      if (hour !== DAILY_REMINDER_HOUR || minute !== 0) continue;

      const channel = user.reminderChannel!;
      const { start: tomorrowStart, end: tomorrowEnd } = getTomorrowUTCRange(user.timezone);

      const appointments = await prisma.appointment.findMany({
        where: {
          patient: { userId: user.id },
          startAt: { gte: tomorrowStart, lte: tomorrowEnd },
          status: { in: [ AppointmentStatus.CONFIRMED ] },
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

      const userName = user.displayName ? user.displayName : `${user.firstName} ${user.lastName}`;
      const tomorrowDate = new Intl.DateTimeFormat(DEFAULT_LOCALE, { timeZone: user.timezone, weekday: "long", month: "long", day: "numeric" }).format(new Date().getTime() + ONE_DAY_MS);
      const payload = buildAppointmentsPayload(appointments, user.timezone);

      try {
        let result = null;
        switch (channel) {
          case Channel.WHATSAPP:
            if (user.whatsappNumber == null) {
              logger.warn({ userId: user.id }, "User missing WhatsApp number, cannot send WhatsApp reminder");
              continue;
            }

            const { contentSid, contentVariables } = buildWhatsAppContent(userName, tomorrowDate, payload);

            result = await sendWhatsApp({
              to: user.whatsappNumber,
              contentSid,
              contentVariables,
            });
            break;

          case Channel.SMS:
            if (user.phoneNumber == null) {
              logger.warn({ userId: user.id }, "User missing phone number, cannot send SMS reminder");
              continue;
            }

            const body = `Buenas tardes, ${userName}:\n\nLe informamos que a continuación encontrará su horario de citas para mañana el ${tomorrowDate}:\n\n${payload.join("\n")}\n\nQue tenga un excelente día!`;
            result = await sendSms({
              to: user.phoneNumber,
              body,
            });
            break;

          case Channel.EMAIL:
            logger.warn({ userId: user.id }, "EMAIL channel is not yet implemented for daily reminders");
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
          logger.info({ userId: user.id, channel, result }, "Daily reminder created");
        } else {
          logger.error({ userId: user.id, channel, error: result.error }, "Failed to send daily reminder");
        }
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
  schedulerTask = cron.schedule(config.scheduler.schedule, async () => {
    try {
      sentReminders = await reminderWorker(sentReminders);
      await appointmentWorker();
      await dailyReminderWorker();
    } catch (err) {
      logger.error({ err }, "Scheduler cycle failed — will retry next minute");
    }
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

