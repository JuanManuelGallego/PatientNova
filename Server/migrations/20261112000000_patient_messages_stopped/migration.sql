-- Set when a patient withdraws from automated messages; no reminder or notice is sent while it has a value.
ALTER TABLE "patients" ADD COLUMN "messagesStoppedAt" TIMESTAMP(3);
