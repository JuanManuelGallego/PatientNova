-- Raw-SQL only (Prisma cannot express EXCLUDE constraints); see AGENTS.md "Raw-SQL-only database objects".
-- A provider can never have two active appointments that overlap in time.
-- Half-open ranges: back-to-back appointments (end == next start) are allowed.
-- Columns are TIMESTAMP(3) (UTC values), so tsrange is the correct range type.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "appointments"
  ADD CONSTRAINT appointments_no_provider_overlap
  EXCLUDE USING gist (
    "userId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (status IN ('SCHEDULED', 'CONFIRMED') AND NOT "isDeleted");
