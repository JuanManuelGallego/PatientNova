-- DropIndex
DROP INDEX "patients_userId_email_key";

-- CreateIndex
CREATE UNIQUE INDEX patients_userId_email_active_key
  ON "patients" ("userId", "email")
  WHERE "isDeleted" = false;