import { Channel, AppointmentStatus } from "../../../generated/prisma/client.ts";
import { prisma } from "../../prisma/prismaClient.js";
import { APPT_SID_MAP, config } from "../../utils/config.ts";
import { DEFAULT_LOCALE, DAILY_REMINDER_HOUR } from "../../utils/constants.ts";
import { logger } from "../../utils/logger.ts";
import { getLocalTimeParts, getTomorrowUTCRange } from "../../utils/timeUtils.ts";
import { dispatchMessage, type DispatchOpts } from "../dispatch.js";
import type { AppointmentWithDetails } from "../../utils/types.ts";

function buildAppointmentsPayload(appointments: AppointmentWithDetails[], timezone: string): string[] {
  const fmt = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return appointments
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .map((appt) => {
      const time = fmt.format(appt.startAt);
      const name = `${appt.patient.name} ${appt.patient.lastName}`;
      const location = appt.appointmentLocation?.name ?? "No location specified";
      return `• ${name} — ${time} — ${location}`;
    });
}

function buildDispatchOpts(
  channel: Channel,
  user: { whatsappNumber: string | null; phoneNumber: string | null },
  userName: string,
  tomorrowDate: string,
  payload: string[]
): DispatchOpts | null {
  switch (channel) {
    case Channel.WHATSAPP: {
      if (!user.whatsappNumber) return null;
      const contentSid = APPT_SID_MAP[ payload.length ] ?? config.twilio.tomorrowAppointmentsReminderSid;
      const base = { "1": userName, "2": tomorrowDate };
      const contentVariables = APPT_SID_MAP[ payload.length ]
        ? payload.reduce((acc, item, i) => ({ ...acc, [ String(i + 3) ]: item || "N/A" }), base)
        : { ...base, "3": payload.join(" | ") };
      return { to: user.whatsappNumber, contentSid, contentVariables };
    }

    case Channel.SMS: {
      if (!user.phoneNumber) return null;
      const body = [
        `Buenas tardes, ${userName}:`,
        `\nLe informamos que a continuación encontrará su horario de citas para mañana el ${tomorrowDate}:\n`,
        payload.join("\n"),
        "\nQue tenga un excelente día!",
      ].join("\n");
      return { to: user.phoneNumber, body };
    }

    default:
      return { to: "" }; // dispatchMessage handles unsupported channels uniformly
  }
}

/** Returns the local calendar date string (YYYY-MM-DD) for a given timezone. */
function getTodayLocalDate(timezone: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(new Date());
}

/** Returns the local calendar date string (YYYY-MM-DD) for tomorrow in a given timezone. */
function getTomorrowLocalDate(timezone: string): string {
  const { year, month, day } = getLocalTimeParts(timezone);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(tomorrow);
}

export async function dailyReminderWorker(): Promise<void> {

  const users = await prisma.user.findMany({
    where: { reminderActive: true },
    select: {
      id: true,
      timezone: true,
      reminderChannel: true,
      whatsappNumber: true,
      phoneNumber: true,
      firstName: true,
      lastName: true,
      displayName: true,
      lastDailyReminderDate: true,
    },
  });

  for (const user of users) {
    try {
      const { hour } = getLocalTimeParts(user.timezone);
      if (hour !== DAILY_REMINDER_HOUR) continue;
      logger.debug("Running daily reminder worker...");

      const todayLocal = getTodayLocalDate(user.timezone);
      if (user.lastDailyReminderDate) {
        const lastSentDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" })
          .format(user.lastDailyReminderDate);
        if (lastSentDate === todayLocal) {
          logger.info({ userId: user.id }, "Daily reminder already sent today — skipping");
          continue;
        }
      }

      const channel = user.reminderChannel! as Channel;
      const { start: tomorrowStart, end: tomorrowEnd } = getTomorrowUTCRange(user.timezone);

      const appointments = await prisma.appointment.findMany({
        where: {
          patient: { userId: user.id },
          startAt: { gte: tomorrowStart, lte: tomorrowEnd },
          status: { in: [ AppointmentStatus.CONFIRMED ] },
        },
        include: { patient: true, appointmentLocation: true },
      });

      if (appointments.length === 0) {
        logger.info({ userId: user.id }, "No tomorrow appointments for user");
        continue;
      }

      const userName = user.displayName ?? `${user.firstName} ${user.lastName}`;

      // Use calendar arithmetic for tomorrow's date string — safe across DST
      const tomorrowLocalDate = getTomorrowLocalDate(user.timezone);
      const tomorrowDate = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        timeZone: user.timezone,
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date(tomorrowLocalDate + "T12:00:00Z"));

      const payload = buildAppointmentsPayload(appointments, user.timezone);
      const opts = buildDispatchOpts(channel, user, userName, tomorrowDate, payload);

      if (!opts) {
        logger.warn({ userId: user.id, channel }, "Missing contact info for daily reminder channel");
        continue;
      }

      logger.info({ userId: user.id, count: appointments.length }, "Sending daily reminder");
      const result = await dispatchMessage(channel, opts);

      if (result.success) {
        // Persist the send date before logging so a crash here doesn't lose the record
        await prisma.user.update({
          where: { id: user.id },
          data: { lastDailyReminderDate: new Date(todayLocal) },
        });
        logger.info({ userId: user.id, channel }, "Daily reminder sent");
      } else {
        logger.error({ userId: user.id, channel, error: result.error }, "Failed to send daily reminder");
      }
    } catch (err) {
      logger.error({ userId: user.id, err }, "Error in daily reminder worker for user");
    }
  }
}
