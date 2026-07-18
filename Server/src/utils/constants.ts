// Time constants (all in milliseconds)
export const ONE_SECOND_MS = 1_000;
export const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
export const FIFTEEN_MINUTES_MS = 15 * ONE_MINUTE_MS;
export const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
export const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

/** Max reminders to process per scheduler tick (prevents runaway on large backlogs). */
export const REMINDER_BATCH_SIZE = 100;

/** Max concurrent Twilio status polls per tick. */
export const REMINDER_POLL_CONCURRENCY = 10;

/** Local hour (0–23) at which the daily appointment reminder is dispatched to users. */
export const DAILY_REMINDER_HOUR = 18;

/**
 * Max delivery attempts for a `send-reminder` job.
 * Kept in sync with the `send-reminder` queue `retryLimit` in pgBoss.ts: the
 * sendReminder worker uses this to mark the reminder FAILED on the final retry.
 */
export const REMINDER_SEND_RETRY_LIMIT = 3;

/** Default locale used for date/time formatting in user-facing messages. */
export const DEFAULT_LOCALE = 'es-ES';
