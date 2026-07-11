import cron, { type ScheduledTask } from "node-cron";
import { logger } from "../utils/logger";
import { appointmentWorker } from "./appointmentWorker";
import { dailyReminderWorker } from "./dailyReminderWorker";
import { reminderWorker } from "./reminderWorker";
import { config } from "../utils/config";

let schedulerTask: ScheduledTask | null = null;

export function initializeSchedulers(): void {
  logger.info("Initializing schedulers...");

  schedulerTask = cron.schedule(config.scheduler.schedule, async () => {
    const results: { worker: string; success: boolean; error?: unknown }[] = [];

    try {
      await reminderWorker();
      results.push({ worker: 'reminderWorker', success: true });
    } catch (err) {
      logger.error({ err }, 'reminderWorker failed');
      results.push({ worker: 'reminderWorker', success: false, error: err });
    }

    try {
      await appointmentWorker();
      results.push({ worker: 'appointmentWorker', success: true });
    } catch (err) {
      logger.error({ err }, 'appointmentWorker failed');
      results.push({ worker: 'appointmentWorker', success: false, error: err });
    }

    try {
      await dailyReminderWorker();
      results.push({ worker: 'dailyReminderWorker', success: true });
    } catch (err) {
      logger.error({ err }, 'dailyReminderWorker failed');
      results.push({ worker: 'dailyReminderWorker', success: false, error: err });
    }

    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      logger.warn({ failedWorkers: failed.map(r => r.worker) }, 'Scheduler cycle completed with failures');
    }
  });

  logger.info("Schedulers initialized => running every minute");
}

export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask.destroy();
    schedulerTask = null;
    logger.info("Schedulers stopped");
  }
}
