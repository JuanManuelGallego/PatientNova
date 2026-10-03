-- AlterEnum
ALTER TYPE "Channel" ADD VALUE 'EMAIL';

-- AlterTable
ALTER TABLE "reminders" ALTER COLUMN "to" SET DATA TYPE VARCHAR(255),
ADD COLUMN     "subject" VARCHAR(255);
