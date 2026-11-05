-- The portal identity becomes a verified contact (email or phone). Renamed by hand: Prisma would generate a drop and an
-- add, which would throw away codes in flight, send counters and failure counts. The stored hashes keep their meaning.
ALTER TABLE "portal_otps" RENAME COLUMN "emailHash" TO "contactHash";
ALTER INDEX "portal_otps_userId_emailHash_key" RENAME TO "portal_otps_userId_contactHash_key";
ALTER TABLE "portal_otps" ADD COLUMN "channel" "Channel" NOT NULL DEFAULT 'EMAIL';
CREATE INDEX "portal_otps_channel_lastSentAt_idx" ON "portal_otps"("channel", "lastSentAt");

ALTER TABLE "booking_requests" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "booking_requests" ADD COLUMN "contactChannel" "Channel" NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "booking_requests" ADD COLUMN "verifiedPhone" TEXT;
ALTER TABLE "booking_requests" ADD COLUMN "verifiedPhoneHash" VARCHAR(64);
CREATE INDEX "booking_requests_userId_verifiedPhoneHash_status_idx" ON "booking_requests"("userId", "verifiedPhoneHash", "status");
