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

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('VIEWER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "SubsistemaType" AS ENUM ('CONYUGAL', 'PARENTAL', 'FILIAL', 'FRATERNO');

-- CreateEnum
CREATE TYPE "EstadoRelacion" AS ENUM ('FUNCIONAL', 'DISFUNCIONAL', 'DISFUNCIONAL_COMUNICACION', 'DISFUNCIONAL_JERARQUIA', 'DISFUNCIONAL_LIMITES');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Relationship" AS ENUM ('FATHER', 'MOTHER', 'SIBLING', 'SON', 'DAUGHTER', 'SPOUSE', 'GRANDFATHER', 'GRANDMOTHER', 'OTHER');

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "whatsappNumber" VARCHAR(20),
    "smsNumber" VARCHAR(20),
    "email" VARCHAR(255),
    "notes" TEXT,
    "appointmentTypeId" UUID,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

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
    "body" TEXT,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sendMode" "ReminderMode" NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "messageId" VARCHAR(100),
    "appointmentId" UUID,
    "patientId" UUID NOT NULL,
    "userId" TEXT NOT NULL,

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
    "meetingUrl" VARCHAR(500),
    "notes" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "patientId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderId" UUID,
    "locationId" UUID,
    "typeId" UUID,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'VIEWER',
    "status" "AdminStatus" NOT NULL DEFAULT 'PENDING',
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "jobTitle" TEXT,
    "logo" TEXT,
    "altLogo" TEXT,
    "phoneNumber" VARCHAR(20),
    "whatsappNumber" VARCHAR(20),
    "reminderActive" BOOLEAN NOT NULL DEFAULT true,
    "reminderChannel" "Channel" NOT NULL DEFAULT 'WHATSAPP',
    "lastDailyReminderDate" TIMESTAMP(3),
    "bankName" TEXT,
    "accountNumber" TEXT,
    "nationalId" TEXT,
    "bankingKey" TEXT,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'America/Bogota',
    "lastPasswordChange" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "refreshTokenVersion" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_locations" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(255),
    "instructions" VARCHAR(500),
    "color" VARCHAR(20),
    "bg" VARCHAR(20),
    "dot" VARCHAR(20),
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

-- CreateTable
CREATE TABLE "medical_records" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "nationalId" TEXT,
    "sex" TEXT,
    "age" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthPlace" TEXT,
    "consultationReason" TEXT,
    "earlyDevelopment" TEXT,
    "schoolAndWork" TEXT,
    "lifestyleHabits" TEXT,
    "traumaticEvents" TEXT,
    "emotionalConsiderations" TEXT,
    "physicalConsiderations" TEXT,
    "mentalHistory" TEXT,
    "objective" TEXT,
    "familyObservations" TEXT,
    "isFamily" BOOLEAN NOT NULL DEFAULT false,
    "familyType" TEXT,
    "lifecycle" TEXT,
    "genogram" TEXT,
    "ressources" TEXT,
    "difficulties" TEXT,
    "communication" TEXT,
    "rule" TEXT,
    "limits" TEXT,
    "familyContext" TEXT,
    "expectations" TEXT,
    "flexibility" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" UUID NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsystem_relations" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "subsistema" "SubsistemaType" NOT NULL,
    "estado" "EstadoRelacion" NOT NULL,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subsystem_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "sex" "Sex",
    "age" TEXT,
    "relationship" "Relationship",
    "relation" TEXT,
    "medicalRecordId" UUID NOT NULL,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evolution_notes" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "text" TEXT,
    "medicalRecordId" UUID NOT NULL,

    CONSTRAINT "evolution_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_documents" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "medicalRecordId" UUID NOT NULL,

    CONSTRAINT "medical_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patients_userId_idx" ON "patients"("userId");

-- CreateIndex
CREATE INDEX "patients_userId_status_idx" ON "patients"("userId", "status");

-- CreateIndex
CREATE INDEX "patients_name_idx" ON "patients"("name");

-- CreateIndex
CREATE INDEX "patients_lastName_idx" ON "patients"("lastName");

-- CreateIndex
CREATE INDEX "patients_status_idx" ON "patients"("status");

-- CreateIndex
CREATE UNIQUE INDEX "patients_userId_email_key" ON "patients"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "reminders_appointmentId_key" ON "reminders"("appointmentId");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- CreateIndex
CREATE INDEX "reminders_sendAt_idx" ON "reminders"("sendAt");

-- CreateIndex
CREATE INDEX "reminders_patientId_idx" ON "reminders"("patientId");

-- CreateIndex
CREATE INDEX "reminders_userId_idx" ON "reminders"("userId");

-- CreateIndex
CREATE INDEX "reminders_status_sendAt_idx" ON "reminders"("status", "sendAt");

-- CreateIndex
CREATE INDEX "reminders_userId_status_idx" ON "reminders"("userId", "status");

-- CreateIndex
CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");

-- CreateIndex
CREATE INDEX "appointments_userId_idx" ON "appointments"("userId");

-- CreateIndex
CREATE INDEX "appointments_startAt_idx" ON "appointments"("startAt");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_startAt_status_idx" ON "appointments"("startAt", "status");

-- CreateIndex
CREATE INDEX "appointments_userId_status_idx" ON "appointments"("userId", "status");

-- CreateIndex
CREATE INDEX "appointments_userId_startAt_idx" ON "appointments"("userId", "startAt");

-- CreateIndex
CREATE INDEX "appointments_locationId_idx" ON "appointments"("locationId");

-- CreateIndex
CREATE INDEX "appointments_typeId_idx" ON "appointments"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "appointment_locations_userId_idx" ON "appointment_locations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_locations_userId_name_key" ON "appointment_locations"("userId", "name");

-- CreateIndex
CREATE INDEX "appointment_types_userId_idx" ON "appointment_types"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_types_userId_name_key" ON "appointment_types"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_patientId_key" ON "medical_records"("patientId");

-- CreateIndex
CREATE INDEX "medical_records_patientId_idx" ON "medical_records"("patientId");

-- CreateIndex
CREATE INDEX "subsystem_relations_medicalRecordId_idx" ON "subsystem_relations"("medicalRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "subsystem_relations_medicalRecordId_subsistema_estado_key" ON "subsystem_relations"("medicalRecordId", "subsistema", "estado");

-- CreateIndex
CREATE INDEX "family_members_medicalRecordId_idx" ON "family_members"("medicalRecordId");

-- CreateIndex
CREATE INDEX "evolution_notes_medicalRecordId_idx" ON "evolution_notes"("medicalRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_userId_key" ON "documents"("userId");

-- CreateIndex
CREATE INDEX "medical_documents_medicalRecordId_idx" ON "medical_documents"("medicalRecordId");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_appointmentTypeId_fkey" FOREIGN KEY ("appointmentTypeId") REFERENCES "appointment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "appointment_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "appointment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_locations" ADD CONSTRAINT "appointment_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_types" ADD CONSTRAINT "appointment_types_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsystem_relations" ADD CONSTRAINT "subsystem_relations_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evolution_notes" ADD CONSTRAINT "evolution_notes_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
