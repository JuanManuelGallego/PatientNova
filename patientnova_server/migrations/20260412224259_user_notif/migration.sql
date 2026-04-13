/*
  Warnings:

  - You are about to drop the column `meetingUrl` on the `appointment_locations` table. All the data in the column will be lost.
  - You are about to drop the column `notificationPreferences` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "appointment_locations" DROP COLUMN "meetingUrl";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "notificationPreferences",
ADD COLUMN     "reminderActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminderChannel" "Channel";
