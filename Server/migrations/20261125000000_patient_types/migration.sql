-- Patient types (#144): each provider defines its own types; every patient has one; consent PDFs move from one
-- per provider (documents) to immutable versions per type (consent_document_versions).

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'PATIENT_TYPE';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'SEND';

-- CreateTable
CREATE TABLE "patient_types" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "template" JSONB NOT NULL DEFAULT '{"sections": []}',
    "familyMembersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "subsystemRelationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_document_versions" (
    "id" TEXT NOT NULL,
    "patientTypeId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "content" BYTEA NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_types_userId_idx" ON "patient_types"("userId");
CREATE UNIQUE INDEX "patient_types_userId_name_key" ON "patient_types"("userId", "name");
CREATE UNIQUE INDEX "consent_document_versions_patientTypeId_version_key" ON "consent_document_versions"("patientTypeId", "version");

-- AddForeignKey
ALTER TABLE "patient_types" ADD CONSTRAINT "patient_types_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consent_document_versions" ADD CONSTRAINT "consent_document_versions_patientTypeId_fkey" FOREIGN KEY ("patientTypeId") REFERENCES "patient_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable (nullable first: filled below)
ALTER TABLE "users" ADD COLUMN "defaultPatientTypeId" UUID;
ALTER TABLE "patients" ADD COLUMN "patientTypeId" UUID;

-- Data: every existing provider gets "Individual" (default) and "Familia" (family lists on). Templates stay empty
-- until #145 fills them with today's forms.
INSERT INTO "patient_types" ("id", "userId", "name", "familyMembersEnabled", "subsystemRelationsEnabled", "updatedAt")
SELECT gen_random_uuid(), u."id", t."name", t."family", t."family", CURRENT_TIMESTAMP
FROM "users" u
CROSS JOIN (VALUES ('Individual', false), ('Familia', true)) AS t("name", "family");

UPDATE "users" u
SET "defaultPatientTypeId" = pt."id"
FROM "patient_types" pt
WHERE pt."userId" = u."id" AND pt."name" = 'Individual';

-- Patients whose record is a family record get "Familia"; every other patient gets "Individual".
UPDATE "patients" p
SET "patientTypeId" = pt."id"
FROM "patient_types" pt
WHERE pt."userId" = p."userId"
  AND pt."name" = CASE
    WHEN EXISTS (SELECT 1 FROM "medical_records" mr WHERE mr."patientId" = p."id" AND mr."isFamily") THEN 'Familia'
    ELSE 'Individual'
  END;

-- The provider's current consent document becomes version 1 of both types. Ids are cuid-shaped ('c' + 24 of
-- [0-9a-f]) so the public download route accepts them.
INSERT INTO "consent_document_versions" ("id", "patientTypeId", "version", "name", "content", "mimeType", "sizeBytes", "createdAt")
SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text || pt."id"::text), 1, 24),
       pt."id", 1, left(d."name", 255), d."content", left(d."mimeType", 100),
       COALESCE(d."sizeBytes", octet_length(d."content")), d."updatedAt"
FROM "documents" d
JOIN "patient_types" pt ON pt."userId" = d."userId";

ALTER TABLE "patients" ALTER COLUMN "patientTypeId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "patients_patientTypeId_idx" ON "patients"("patientTypeId");
CREATE UNIQUE INDEX "users_defaultPatientTypeId_key" ON "users"("defaultPatientTypeId");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_patientTypeId_fkey" FOREIGN KEY ("patientTypeId") REFERENCES "patient_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_defaultPatientTypeId_fkey" FOREIGN KEY ("defaultPatientTypeId") REFERENCES "patient_types"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- DropTable
DROP TABLE "documents";
