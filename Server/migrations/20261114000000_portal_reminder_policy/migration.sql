-- Provider policy for the reminder of portal appointments: on/off and how many hours before the start it goes out.
ALTER TABLE "users" ADD COLUMN "portalReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "portalReminderLeadHours" INTEGER NOT NULL DEFAULT 24;
