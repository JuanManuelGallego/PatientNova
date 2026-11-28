-- Drop the clinical and family columns of medical records (#146, release C). Since release B the payload in "data"
-- is the record: these columns stayed at their release A values and nothing reads them. A row whose payload was never
-- written still has its only copy here, so refuse to drop anything while one exists (a type change leaves '{}').

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "medical_records"
    WHERE "data" IS NULL
      AND COALESCE("consultationReason", "earlyDevelopment", "schoolAndWork", "lifestyleHabits", "traumaticEvents",
        "emotionalConsiderations", "physicalConsiderations", "mentalHistory", "objective", "familyObservations",
        "familyType", "lifecycle", "genogram", "resources", "difficulties", "communication", "rule", "limits",
        "familyContext", "expectations", "flexibility") IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'medical_records has clinical column values with no payload: copy them into the payload before dropping the columns';
  END IF;
END $$;

ALTER TABLE "medical_records"
  DROP COLUMN "consultationReason",
  DROP COLUMN "earlyDevelopment",
  DROP COLUMN "schoolAndWork",
  DROP COLUMN "lifestyleHabits",
  DROP COLUMN "traumaticEvents",
  DROP COLUMN "emotionalConsiderations",
  DROP COLUMN "physicalConsiderations",
  DROP COLUMN "mentalHistory",
  DROP COLUMN "objective",
  DROP COLUMN "familyObservations",
  DROP COLUMN "isFamily",
  DROP COLUMN "familyType",
  DROP COLUMN "lifecycle",
  DROP COLUMN "genogram",
  DROP COLUMN "resources",
  DROP COLUMN "difficulties",
  DROP COLUMN "communication",
  DROP COLUMN "rule",
  DROP COLUMN "limits",
  DROP COLUMN "familyContext",
  DROP COLUMN "expectations",
  DROP COLUMN "flexibility";
