-- Raw-SQL only (Prisma cannot express expression/partial indexes); see AGENTS.md.
-- Normalize stored patient emails and enforce uniqueness on the normalized value so rows
-- differing only by case/whitespace can no longer coexist per provider.
UPDATE "patients"
SET "email" = NULLIF(lower(btrim("email")), '')
WHERE "email" IS NOT NULL
  AND "email" IS DISTINCT FROM NULLIF(lower(btrim("email")), '');

DROP INDEX IF EXISTS "patients_userId_email_active_key";

CREATE UNIQUE INDEX "patients_userId_email_normalized_active_key"
  ON "patients" ("userId", lower(btrim("email")))
  WHERE "isDeleted" = false;
