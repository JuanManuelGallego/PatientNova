ALTER TYPE "BookingRequestStatus" ADD VALUE 'UNCONFIRMED';

ALTER TABLE "booking_requests" ADD COLUMN     "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN     "confirmTokenHash" VARCHAR(64),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "releaseTokenHash" VARCHAR(64);

UPDATE "booking_requests" SET "confirmedAt" = "createdAt";

CREATE UNIQUE INDEX "booking_requests_confirmTokenHash_key" ON "booking_requests"("confirmTokenHash");

CREATE UNIQUE INDEX "booking_requests_releaseTokenHash_key" ON "booking_requests"("releaseTokenHash");
