-- CreateEnum
CREATE TYPE "BookingRequestKind" AS ENUM ('NEW', 'REVIEW');

-- CreateEnum
CREATE TYPE "BookingRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "booking_requests" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "kind" "BookingRequestKind" NOT NULL DEFAULT 'NEW',
    "status" "BookingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "emailHash" VARCHAR(64),
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "patientTimezone" VARCHAR(50) NOT NULL,
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "nudgedAt" TIMESTAMP(3),
    "policyVersion" VARCHAR(20) NOT NULL,
    "consentAcceptedAt" TIMESTAMP(3) NOT NULL,
    "consentIp" VARCHAR(64),
    "consentUserAgent" VARCHAR(512),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "userId" TEXT NOT NULL,
    "typeId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "patientId" UUID,
    "appointmentId" UUID,

    CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_requests_userId_status_holdExpiresAt_idx" ON "booking_requests"("userId", "status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "booking_requests_userId_emailHash_status_idx" ON "booking_requests"("userId", "emailHash", "status");

-- CreateIndex
CREATE INDEX "booking_requests_userId_startAt_idx" ON "booking_requests"("userId", "startAt");

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "appointment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "appointment_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Raw-SQL only (Prisma cannot express EXCLUDE constraints); see AGENTS.md "Raw-SQL-only database objects".
-- A provider can never have two PENDING holds that overlap in time (half-open ranges, TIMESTAMP(3) UTC values).
-- It cannot depend on now(), so holds past holdExpiresAt are flipped to EXPIRED under the provider lock before a new
-- hold is inserted. Overlap between holds and appointments is covered by the provider lock and the slot engine.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "booking_requests"
  ADD CONSTRAINT booking_requests_no_hold_overlap
  EXCLUDE USING gist (
    "userId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (status = 'PENDING');
