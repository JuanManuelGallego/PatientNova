-- AlterTable: add lastDailyReminderDate to track idempotency for daily reminder worker
ALTER TABLE "users" ADD COLUMN "lastDailyReminderDate" DATE;
