-- 5.4: video-call link state, so portal bookings at a virtual location can wait for a link.
CREATE TYPE "MeetingStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'NEEDS_LINK', 'READY');

ALTER TABLE "appointments" ADD COLUMN "meetingStatus" "MeetingStatus" NOT NULL DEFAULT 'NOT_REQUIRED';

-- Every existing link is ready; virtual appointments always required one before 5.4.
UPDATE "appointments" SET "meetingStatus" = 'READY' WHERE "meetingUrl" IS NOT NULL;
