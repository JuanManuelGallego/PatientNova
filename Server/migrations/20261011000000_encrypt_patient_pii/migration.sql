-- Patient PII is encrypted at rest by the application (AES-256-GCM, random IV), so the plaintext
-- columns become opaque ciphertext: widened to TEXT and no longer indexed. Lookups and search use
-- keyed blind indexes (HMAC-SHA256) written next to them. Existing rows are encrypted and hashed by
-- `pnpm run pii:backfill` (run on start, after this migration); see docs/compliance-patient-data.md.

-- DropIndex
DROP INDEX "patients_lastName_idx";

-- DropIndex
DROP INDEX "patients_name_idx";

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "nameTokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "piiVersion" SMALLINT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "emailHash" VARCHAR(64),
ADD COLUMN     "lastNameTokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nameTokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "piiVersion" SMALLINT,
ADD COLUMN     "smsHash" VARCHAR(64),
ADD COLUMN     "whatsappHash" VARCHAR(64),
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "lastName" SET DATA TYPE TEXT,
ALTER COLUMN "whatsappNumber" SET DATA TYPE TEXT,
ALTER COLUMN "smsNumber" SET DATA TYPE TEXT,
ALTER COLUMN "email" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "piiVersion" SMALLINT,
ADD COLUMN     "toHash" VARCHAR(64),
ALTER COLUMN "to" SET DATA TYPE TEXT,
ALTER COLUMN "subject" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "medical_records_nameTokens_idx" ON "medical_records" USING GIN ("nameTokens");

-- CreateIndex
CREATE INDEX "patients_userId_whatsappHash_idx" ON "patients"("userId", "whatsappHash");

-- CreateIndex
CREATE INDEX "patients_userId_smsHash_idx" ON "patients"("userId", "smsHash");

-- CreateIndex
CREATE INDEX "patients_nameTokens_idx" ON "patients" USING GIN ("nameTokens");

-- CreateIndex
CREATE INDEX "patients_lastNameTokens_idx" ON "patients" USING GIN ("lastNameTokens");

-- CreateIndex
CREATE INDEX "reminders_toHash_idx" ON "reminders"("toHash");


-- Raw-SQL only (partial unique index); see AGENTS.md "Raw-SQL-only database objects".
-- Email uniqueness per provider among active patients now holds on the blind index. The previous
-- expression index on lower(btrim("email")) is meaningless over ciphertext.
DROP INDEX IF EXISTS "patients_userId_email_normalized_active_key";

CREATE UNIQUE INDEX "patients_userId_emailHash_active_key"
  ON "patients" ("userId", "emailHash")
  WHERE "isDeleted" = false;
