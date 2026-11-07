-- Who answers for patient data at each clinic: shown to patients before they authorize anything.
ALTER TABLE "users" ADD COLUMN "legalName" VARCHAR(200);
ALTER TABLE "users" ADD COLUMN "privacyContact" VARCHAR(200);
ALTER TABLE "users" ADD COLUMN "contactHours" VARCHAR(120);
