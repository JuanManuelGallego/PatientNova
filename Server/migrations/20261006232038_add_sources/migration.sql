-- CreateEnum
CREATE TYPE "RecordSource" AS ENUM ('PROVIDER', 'PORTAL');

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('PROVIDER', 'PATIENT');

-- DropIndex
DROP INDEX "google_connections_userId_idx";

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "cancelledBy" "CancelledBy",
ADD COLUMN     "source" "RecordSource" NOT NULL DEFAULT 'PROVIDER';

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "source" "RecordSource" NOT NULL DEFAULT 'PROVIDER';
