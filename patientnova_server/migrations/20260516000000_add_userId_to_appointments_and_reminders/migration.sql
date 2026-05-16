-- Add userId column to appointments and reminders tables with foreign key constraints

-- Add userId to appointments
ALTER TABLE "appointments" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';

-- Populate userId from patient relationship
UPDATE "appointments" SET "userId" = (
  SELECT "userId" FROM "patients" WHERE "patients"."id" = "appointments"."patientId"
);

-- Add foreign key constraint for userId in appointments
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add indexes for appointments
CREATE INDEX "appointments_userId_idx" ON "appointments"("userId");
CREATE INDEX "appointments_userId_status_idx" ON "appointments"("userId", "status");
CREATE INDEX "appointments_userId_startAt_idx" ON "appointments"("userId", "startAt");

-- Add userId to reminders
ALTER TABLE "reminders" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';

-- Populate userId from patient relationship
UPDATE "reminders" SET "userId" = (
  SELECT "userId" FROM "patients" WHERE "patients"."id" = "reminders"."patientId"
);

-- Add foreign key constraint for userId in reminders
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add indexes for reminders
CREATE INDEX "reminders_userId_idx" ON "reminders"("userId");
CREATE INDEX "reminders_userId_status_idx" ON "reminders"("userId", "status");
