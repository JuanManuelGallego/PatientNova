-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('USER', 'APPOINTMENT', 'PATIENT', 'REMINDER', 'MEDICAL_RECORD', 'APPOINTMENT_TYPE', 'APPOINTMENT_LOCATION', 'BLOCKED_TIME', 'CONSENT_DOCUMENT');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE');

-- CreateEnum
CREATE TYPE "ActionSource" AS ENUM ('API', 'ADMIN_PANEL', 'JOB', 'MIGRATION');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorDisplayName" TEXT NOT NULL,
    "eventTimeUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "source" "ActionSource" NOT NULL,
    "description" TEXT NOT NULL,
    "affectedFields" TEXT[],
    "fieldsBefore" JSONB,
    "fieldsAfter" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_eventTimeUtc_idx" ON "AuditLog"("eventTimeUtc");
