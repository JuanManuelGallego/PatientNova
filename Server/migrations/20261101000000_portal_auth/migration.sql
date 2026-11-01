-- CreateEnum
CREATE TYPE "ConsentKind" AS ENUM ('DATA_PROCESSING');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "portalAccessEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "portal_otps" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailHash" VARCHAR(64) NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "sendWindowStart" TIMESTAMP(3) NOT NULL,
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,

    CONSTRAINT "portal_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_consents" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "ConsentKind" NOT NULL,
    "policyVersion" VARCHAR(20) NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(512),
    "revokedAt" TIMESTAMP(3),
    "patientId" UUID NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "patient_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portal_otps_userId_lastSentAt_idx" ON "portal_otps"("userId", "lastSentAt");

-- CreateIndex
CREATE INDEX "portal_otps_lastSentAt_idx" ON "portal_otps"("lastSentAt");

-- CreateIndex
CREATE UNIQUE INDEX "portal_otps_userId_emailHash_key" ON "portal_otps"("userId", "emailHash");

-- CreateIndex
CREATE INDEX "patient_consents_patientId_idx" ON "patient_consents"("patientId");

-- CreateIndex
CREATE INDEX "patient_consents_userId_idx" ON "patient_consents"("userId");

-- AddForeignKey
ALTER TABLE "portal_otps" ADD CONSTRAINT "portal_otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Raw-only (not expressible in schema.prisma, so invisible to Prisma's diff; see AGENTS.md):
-- at most one active consent per patient, kind and policy version. `ensureCurrentConsent`
-- inserts with ON CONFLICT DO NOTHING against it, so concurrent accepts never duplicate.
CREATE UNIQUE INDEX "patient_consents_active_key"
    ON "patient_consents"("patientId", "kind", "policyVersion")
    WHERE "revokedAt" IS NULL;
