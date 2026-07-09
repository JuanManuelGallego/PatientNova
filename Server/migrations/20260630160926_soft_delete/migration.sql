/*
  Warnings:

  - You are about to drop the column `bg` on the `appointment_locations` table. All the data in the column will be lost.
  - You are about to drop the column `dot` on the `appointment_locations` table. All the data in the column will be lost.
  - You are about to drop the column `icon` on the `appointment_locations` table. All the data in the column will be lost.
  - You are about to drop the column `icon` on the `appointment_types` table. All the data in the column will be lost.
  - You are about to drop the column `archivedAt` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `avatarUrl` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `deletedById` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "appointment_locations" DROP COLUMN "bg",
DROP COLUMN "dot",
DROP COLUMN "icon",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "appointment_types" DROP COLUMN "icon",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "patients" DROP COLUMN "archivedAt",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "avatarUrl",
DROP COLUMN "deletedById",
ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "appointments_userId_isDeleted_idx" ON "appointments"("userId", "isDeleted");

-- CreateIndex
CREATE INDEX "medical_records_isDeleted_idx" ON "medical_records"("isDeleted");

-- CreateIndex
CREATE INDEX "patients_userId_isDeleted_idx" ON "patients"("userId", "isDeleted");

-- CreateIndex
CREATE INDEX "users_isDeleted_idx" ON "users"("isDeleted");
