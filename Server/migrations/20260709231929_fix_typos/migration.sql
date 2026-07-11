-- Safe, idempotent migration for the `fix_typos` rename.
-- Existence checks make this safe whether Prisma skips it (already applied),
-- retries a previously failed run, or applies it fresh.

-- CreateEnum (guarded)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubsystemType') THEN
    CREATE TYPE "SubsystemType" AS ENUM ('CONJUGAL', 'PARENTAL', 'FILIAL', 'FRATERNAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RelationshipStatus') THEN
    CREATE TYPE "RelationshipStatus" AS ENUM ('FUNCIONAL', 'DISFUNCIONAL', 'DISFUNCIONAL_COMUNICACION', 'DISFUNCIONAL_JERARQUIA', 'DISFUNCIONAL_LIMITES');
  END IF;
END $$;

-- DropIndex (guarded)
DROP INDEX IF EXISTS "subsystem_relations_medicalRecordId_subsistema_estado_key";

-- medical_records: fix the `ressources` typo by renaming (preserves data & type)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medical_records' AND column_name = 'ressources'
  ) THEN
    ALTER TABLE "medical_records" RENAME COLUMN "ressources" TO "resources";
  END IF;
END $$;

-- medical_records: drop the stored `age` column (now derived from birthDate in the app)
ALTER TABLE "medical_records" DROP COLUMN IF EXISTS "age";

-- subsystem_relations: only act if the old columns are still present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subsystem_relations' AND column_name = 'subsistema'
  ) THEN
    ALTER TABLE "subsystem_relations" ADD COLUMN IF NOT EXISTS "status" "RelationshipStatus";
    ALTER TABLE "subsystem_relations" ADD COLUMN IF NOT EXISTS "subsystem" "SubsystemType";

    UPDATE "subsystem_relations"
    SET
      "subsystem" = CASE
        WHEN "subsistema"::text = 'FRATERNO' THEN 'FRATERNAL'::"SubsystemType"
        ELSE "subsistema"::text::"SubsystemType"
      END,
      "status" = "estado"::text::"RelationshipStatus";

    ALTER TABLE "subsystem_relations" ALTER COLUMN "status" SET NOT NULL;
    ALTER TABLE "subsystem_relations" ALTER COLUMN "subsystem" SET NOT NULL;

    ALTER TABLE "subsystem_relations" DROP COLUMN IF EXISTS "estado";
    ALTER TABLE "subsystem_relations" DROP COLUMN IF EXISTS "subsistema";
  END IF;
END $$;

-- medical_records: `sex` text -> enum, keeping valid values and nullifying invalid ones.
-- Idempotent: re-casting an already-enum column is a harmless no-op.
ALTER TABLE "medical_records" ALTER COLUMN "sex" TYPE "Sex"
  USING (CASE WHEN "sex"::text IN ('MALE', 'FEMALE', 'OTHER') THEN "sex"::text::"Sex" ELSE NULL END);

-- CreateIndex (guarded)
CREATE UNIQUE INDEX IF NOT EXISTS "subsystem_relations_medicalRecordId_subsystem_status_key" ON "subsystem_relations"("medicalRecordId", "subsystem", "status");

-- DropEnum (guarded)
DROP TYPE IF EXISTS "EstadoRelacion";
DROP TYPE IF EXISTS "SubsistemaType";
