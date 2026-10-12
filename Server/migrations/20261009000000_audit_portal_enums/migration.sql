-- AlterEnum
ALTER TYPE "ActionSource" ADD VALUE 'PUBLIC_PORTAL';

-- AlterEnum
-- Postgres adds one enum value per statement.
ALTER TYPE "EntityType" ADD VALUE 'BOOKING_REQUEST';
ALTER TYPE "EntityType" ADD VALUE 'PATIENT_CONSENT';
