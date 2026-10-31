-- Drops fields with no business value. The enum changes fail (and roll back) if any row still
-- uses AdminStatus.SUSPENDED or ActionSource.ADMIN_PANEL/MIGRATION; check before deploying.
-- Appointment times are rendered in User.timezone, so Appointment.timezone is no longer needed.

-- AlterEnum
BEGIN;
CREATE TYPE "ActionSource_new" AS ENUM ('API', 'JOB', 'PUBLIC_PORTAL');
ALTER TABLE "AuditLog" ALTER COLUMN "source" TYPE "ActionSource_new" USING ("source"::text::"ActionSource_new");
ALTER TYPE "ActionSource" RENAME TO "ActionSource_old";
ALTER TYPE "ActionSource_new" RENAME TO "ActionSource";
DROP TYPE "public"."ActionSource_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "AdminStatus_new" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');
ALTER TABLE "public"."users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "status" TYPE "AdminStatus_new" USING ("status"::text::"AdminStatus_new");
ALTER TYPE "AdminStatus" RENAME TO "AdminStatus_old";
ALTER TYPE "AdminStatus_new" RENAME TO "AdminStatus";
DROP TYPE "public"."AdminStatus_old";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "reason";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "currency",
DROP COLUMN "reminderId",
DROP COLUMN "timezone";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "checksum";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "lastLoginIp";

