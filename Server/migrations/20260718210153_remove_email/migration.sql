/*
  Warnings:

  - The values [EMAIL] on the enum `Channel` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `observacion` on the `subsystem_relations` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Channel_new" AS ENUM ('WHATSAPP', 'SMS');
ALTER TABLE "public"."users" ALTER COLUMN "reminderChannel" DROP DEFAULT;
ALTER TABLE "reminders" ALTER COLUMN "channel" TYPE "Channel_new" USING ("channel"::text::"Channel_new");
ALTER TABLE "users" ALTER COLUMN "reminderChannel" TYPE "Channel_new" USING ("reminderChannel"::text::"Channel_new");
ALTER TYPE "Channel" RENAME TO "Channel_old";
ALTER TYPE "Channel_new" RENAME TO "Channel";
DROP TYPE "public"."Channel_old";
ALTER TABLE "users" ALTER COLUMN "reminderChannel" SET DEFAULT 'WHATSAPP';
COMMIT;

-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "timezone" SET DEFAULT 'America/Bogota';

-- AlterTable
ALTER TABLE "subsystem_relations" DROP COLUMN "observacion",
ADD COLUMN     "observation" TEXT;
