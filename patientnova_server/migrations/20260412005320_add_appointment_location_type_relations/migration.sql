/*
  Warnings:

  - You are about to drop the column `location` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `appointments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "location",
DROP COLUMN "type",
ADD COLUMN     "locationId" UUID,
ADD COLUMN     "typeId" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notificationPreferences" JSONB,
ADD COLUMN     "phoneNumber" VARCHAR(20),
ADD COLUMN     "whatsappNumber" VARCHAR(20);

-- CreateTable
CREATE TABLE "appointment_locations" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(255),
    "meetingUrl" VARCHAR(500),
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "defaultPrice" INTEGER,
    "isVirtual" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,

    CONSTRAINT "appointment_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_types" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "defaultDuration" INTEGER NOT NULL DEFAULT 60,
    "defaultPrice" INTEGER,
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,

    CONSTRAINT "appointment_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_locations_userId_idx" ON "appointment_locations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_locations_userId_name_key" ON "appointment_locations"("userId", "name");

-- CreateIndex
CREATE INDEX "appointment_types_userId_idx" ON "appointment_types"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_types_userId_name_key" ON "appointment_types"("userId", "name");

-- CreateIndex
CREATE INDEX "appointments_locationId_idx" ON "appointments"("locationId");

-- CreateIndex
CREATE INDEX "appointments_typeId_idx" ON "appointments"("typeId");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "appointment_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "appointment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_locations" ADD CONSTRAINT "appointment_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_types" ADD CONSTRAINT "appointment_types_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
