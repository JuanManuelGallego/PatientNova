-- Calendar days (birth dates, evolution-note dates) are now stored as UTC midnight of the day
-- ("YYYY-MM-DDT00:00:00.000Z"); the Portal reads them by their UTC date, never through a timezone.
--
-- Older Portal builds stored an instant instead: the browser's or the provider's local midnight, or
-- (evolution notes, when the Portal sent a bare "YYYY-MM-DD" that failed validation) the save time.
-- In every case the intended day is the instant's calendar date in the provider's timezone.
--
-- Values already at UTC midnight are left alone, which keeps this idempotent (for a provider in UTC
-- local midnight is UTC midnight, so they are already right). Rows whose provider has a timezone
-- Postgres does not know are skipped rather than failing the migration.

UPDATE "medical_records" AS mr
SET "birthDate" = date_trunc('day', (mr."birthDate" AT TIME ZONE 'UTC') AT TIME ZONE u."timezone")
FROM "patients" AS p
JOIN "users" AS u ON u."id" = p."userId"
WHERE p."id" = mr."patientId"
  AND mr."birthDate" IS NOT NULL
  AND mr."birthDate" <> date_trunc('day', mr."birthDate")
  AND u."timezone" IN (SELECT "name" FROM pg_timezone_names);

UPDATE "evolution_notes" AS en
SET "date" = date_trunc('day', (en."date" AT TIME ZONE 'UTC') AT TIME ZONE u."timezone")
FROM "medical_records" AS mr
JOIN "patients" AS p ON p."id" = mr."patientId"
JOIN "users" AS u ON u."id" = p."userId"
WHERE mr."id" = en."medicalRecordId"
  AND en."date" <> date_trunc('day', en."date")
  AND u."timezone" IN (SELECT "name" FROM pg_timezone_names);
