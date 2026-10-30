/*
  Warnings:

  - A unique constraint covering the columns `[bookingSlug]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BookingApprovalMode" AS ENUM ('AUTO_CONFIRM', 'REQUIRE_APPROVAL');

-- AlterTable
ALTER TABLE "appointment_locations" ADD COLUMN     "bookableOnline" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "appointment_types" ADD COLUMN     "bookableOnline" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bookingApprovalMode" "BookingApprovalMode" NOT NULL DEFAULT 'AUTO_CONFIRM',
ADD COLUMN     "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bookingSlug" VARCHAR(40),
ADD COLUMN     "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxHorizonDays" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "minLeadMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "slotIntervalMinutes" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "availability_rules_userId_weekday_idx" ON "availability_rules"("userId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "users_bookingSlug_key" ON "users"("bookingSlug");

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
