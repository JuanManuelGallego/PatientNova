-- AlterTable
ALTER TABLE "appointment_locations" ADD COLUMN     "instructions" VARCHAR(500);

-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "userId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reminders" ALTER COLUMN "userId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "lastDailyReminderDate" SET DATA TYPE TIMESTAMP(3);
