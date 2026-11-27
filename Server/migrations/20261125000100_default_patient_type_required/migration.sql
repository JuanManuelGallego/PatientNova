-- Every provider has a default patient type (#144). A user and its default type reference each other, so the
-- user's foreign key is checked at commit: both rows are written in one transaction (createUserWithDefaultType).
-- Postgres cannot defer RESTRICT, so the constraint stays NO ACTION, which still refuses deleting a default type.
-- Prisma does not model DEFERRABLE: a generated migration that drops and re-adds this constraint must keep it.

-- Any user left without a default (none expected) gets "General".
INSERT INTO "patient_types" ("id", "userId", "name", "updatedAt")
SELECT gen_random_uuid(), u."id", 'General', CURRENT_TIMESTAMP
FROM "users" u
WHERE u."defaultPatientTypeId" IS NULL
ON CONFLICT ("userId", "name") DO NOTHING;

UPDATE "users" u
SET "defaultPatientTypeId" = pt."id"
FROM "patient_types" pt
WHERE u."defaultPatientTypeId" IS NULL AND pt."userId" = u."id" AND pt."name" = 'General';

ALTER TABLE "users" ALTER COLUMN "defaultPatientTypeId" SET NOT NULL;

ALTER TABLE "users" DROP CONSTRAINT "users_defaultPatientTypeId_fkey";
ALTER TABLE "users" ADD CONSTRAINT "users_defaultPatientTypeId_fkey" FOREIGN KEY ("defaultPatientTypeId")
  REFERENCES "patient_types"("id") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
