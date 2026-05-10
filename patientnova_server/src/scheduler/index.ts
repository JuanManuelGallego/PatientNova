import cron from "node-cron";
import { logger } from "../utils/logger";
import { appointmentWorker } from "./appointmentWorker";
import { dailyReminderWorker } from "./dailyReminderWorker";
import { reminderWorker } from "./reminderWorker";
import { config } from "../utils/config";
import type { TrackedReminder } from "../utils/types";

let schedulerTask: cron.ScheduledTask | null = null;

export function initializeSchedulers(): void {
  logger.info("Initializing schedulers...");
  let sentReminders: TrackedReminder[] = [];

  schedulerTask = cron.schedule(config.scheduler.schedule, async () => {
    try {
      sentReminders = await reminderWorker(sentReminders);
      await appointmentWorker();
      await dailyReminderWorker();
    } catch (err) {
      logger.error({ err }, "Scheduler cycle failed — will retry next run");
    }
  });

  logger.info("Schedulers initialized — running every minute");
}

export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask.destroy();
    schedulerTask = null;
    logger.info("Schedulers stopped");
  }
}
