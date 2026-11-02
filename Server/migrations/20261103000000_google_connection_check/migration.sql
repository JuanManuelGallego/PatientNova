-- 8.2: last successful proactive check of the Google connection.
ALTER TABLE "google_connections" ADD COLUMN "lastCheckedAt" TIMESTAMP(3);
