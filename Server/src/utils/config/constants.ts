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

/**
 * Max delivery attempts for a `send-reminder` job.
 * Kept in sync with the `send-reminder` queue `retryLimit` in pgBoss.ts: the
 * sendReminder worker uses this to mark the reminder FAILED on the final retry.
 */
export const REMINDER_SEND_RETRY_LIMIT = 3;

/** Default locale used for date/time formatting in user-facing messages. */
export const DEFAULT_LOCALE = 'es-ES';

// ─── Bulk Send ──────────────────────────────────────────────────────────────

/** Max messages processed concurrently by the bulk-send worker. */
export const BULK_SEND_CONCURRENCY = 5;

/** Max messages dispatched per rate-limit window (1 minute). */
export const BULK_SEND_RATE_LIMIT = 30;

/** Rate-limit window for bulk sends (1 minute in ms). */
export const BULK_SEND_RATE_WINDOW_MS = 60_000;

/** Delay (ms) between enqueued bulk-send jobs to stagger Twilio calls. */
export const BULK_SEND_STAGGER_MS = 2_000;

/** Max patients per bulk send request. */
export const BULK_SEND_MAX_PATIENTS = 200;

/** Number of reminder creates to batch in a single Promise.all during enqueue. */
export const BULK_SEND_CHUNK_SIZE = 50;
