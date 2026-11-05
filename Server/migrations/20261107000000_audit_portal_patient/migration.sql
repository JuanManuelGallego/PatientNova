-- Portal audit rows link to the patient record they concerned, so per-patient portal activity no longer
-- depends on the patient's current email or collides between records that share an email.
ALTER TABLE "AuditLog" ADD COLUMN "portalPatientId" TEXT;

CREATE INDEX "AuditLog_userId_portalPatientId_idx" ON "AuditLog"("userId", "portalPatientId");

-- Backfill existing portal rows whose entity names its patient. Rows without one (logins, booking requests)
-- stay NULL and are matched through the actor id of the patient's current email.
UPDATE "AuditLog" l SET "portalPatientId" = l."entityId"
WHERE l."source" = 'PUBLIC_PORTAL' AND l."entityType" = 'PATIENT';

UPDATE "AuditLog" l SET "portalPatientId" = a."patientId"::text
FROM "appointments" a
WHERE l."source" = 'PUBLIC_PORTAL' AND l."entityType" = 'APPOINTMENT'
  AND a."id"::text = l."entityId" AND a."userId"::text = l."userId";

UPDATE "AuditLog" l SET "portalPatientId" = c."patientId"::text
FROM "patient_consents" c
WHERE l."source" = 'PUBLIC_PORTAL' AND l."entityType" = 'PATIENT_CONSENT'
  AND c."id"::text = l."entityId";
