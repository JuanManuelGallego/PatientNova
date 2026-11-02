-- 5.5: provider policy for patient reschedules, and the per-appointment counter it is checked against.
ALTER TABLE "users" ADD COLUMN "maxPatientReschedules" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "minRescheduleNoticeHours" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "appointments" ADD COLUMN "patientRescheduleCount" INTEGER NOT NULL DEFAULT 0;
