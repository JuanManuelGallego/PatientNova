-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Relationship" AS ENUM ('FATHER', 'MOTHER', 'SIBLING', 'SON', 'DAUGHTER', 'SPOUSE', 'GRANDFATHER', 'GRANDMOTHER', 'OTHER');

-- CreateTable
CREATE TABLE "medical_records" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "nationalId" TEXT,
    "sex" TEXT,
    "age" TEXT,
    "birthDate" TEXT,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" UUID NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_patientId_key" ON "medical_records"("patientId");

-- CreateIndex
CREATE INDEX "medical_records_patientId_idx" ON "medical_records"("patientId");

-- CreateIndex
CREATE INDEX "family_members_medicalRecordId_idx" ON "family_members"("medicalRecordId");

-- CreateIndex
CREATE INDEX "evolution_notes_medicalRecordId_idx" ON "evolution_notes"("medicalRecordId");

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evolution_notes" ADD CONSTRAINT "evolution_notes_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
