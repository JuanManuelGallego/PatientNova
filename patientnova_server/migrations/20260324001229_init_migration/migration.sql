-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED', 'QUEUED');

-- CreateEnum
CREATE TYPE "ReminderMode" AS ENUM ('IMMEDIATE', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "whatsappNumber" VARCHAR(20),
    "smsNumber" VARCHAR(20),
    "email" VARCHAR(255),
    "dateOfBirth" TIMESTAMP(3),
    "notes" VARCHAR(500),
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "channel" "Channel" NOT NULL,
    "to" VARCHAR(30) NOT NULL,
    "contentSid" VARCHAR(100),
    "contentVariables" JSONB,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sendMode" "ReminderMode" NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "messageId" VARCHAR(100),
    "appointmentId" UUID,
    "patientId" UUID NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'CST',
    "price" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'COP',
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "location" VARCHAR(255) NOT NULL,
    "meetingUrl" VARCHAR(500),
    "notes" VARCHAR(500),
    "type" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "patientId" UUID NOT NULL,
    "reminderId" UUID,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patients_email_key" ON "patients"("email");

-- CreateIndex
CREATE INDEX "patients_name_idx" ON "patients"("name");

-- CreateIndex
CREATE INDEX "patients_lastName_idx" ON "patients"("lastName");

-- CreateIndex
CREATE INDEX "patients_status_idx" ON "patients"("status");

-- CreateIndex
CREATE UNIQUE INDEX "reminders_appointmentId_key" ON "reminders"("appointmentId");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- CreateIndex
CREATE INDEX "reminders_sendAt_idx" ON "reminders"("sendAt");

-- CreateIndex
CREATE INDEX "reminders_patientId_idx" ON "reminders"("patientId");

-- CreateIndex
CREATE INDEX "reminders_status_sendAt_idx" ON "reminders"("status", "sendAt");

-- CreateIndex
CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");

-- CreateIndex
CREATE INDEX "appointments_startAt_idx" ON "appointments"("startAt");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_startAt_status_idx" ON "appointments"("startAt", "status");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
