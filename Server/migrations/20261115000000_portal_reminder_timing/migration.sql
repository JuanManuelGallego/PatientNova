-- The portal reminder becomes one of the appointment modal's presets instead of an on/off flag and a number of hours.
CREATE TYPE "PortalReminderTiming" AS ENUM ('NONE', 'ONE_HOUR_BEFORE', 'ONE_DAY_BEFORE', 'SAME_DAY_MORNING', 'PREVIOUS_DAY_MORNING', 'PREVIOUS_DAY_EVENING');

ALTER TABLE "users" ADD COLUMN "portalReminderTiming" "PortalReminderTiming" NOT NULL DEFAULT 'ONE_DAY_BEFORE';

-- Keep what a provider already chose: off stays off, a lead time under a day becomes the 1-hour preset.
UPDATE "users" SET "portalReminderTiming" = CASE
  WHEN NOT "portalReminderEnabled" THEN 'NONE'::"PortalReminderTiming"
  WHEN "portalReminderLeadHours" < 24 THEN 'ONE_HOUR_BEFORE'::"PortalReminderTiming"
  ELSE 'ONE_DAY_BEFORE'::"PortalReminderTiming"
END;

ALTER TABLE "users" DROP COLUMN "portalReminderEnabled",
DROP COLUMN "portalReminderLeadHours";
