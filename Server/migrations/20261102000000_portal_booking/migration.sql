-- Patient device zone captured at portal booking; NULL for provider-created appointments.
ALTER TABLE "appointments" ADD COLUMN "patientTimezone" VARCHAR(50);
