/*
  Warnings:

  - Changed the type of `channel` on the `reminders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
ALTER TYPE "ReminderChannel" ADD VALUE 'EMAIL';
ALTER TYPE "ReminderChannel" RENAME TO "Channel";

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "fullName" VARCHAR(200);

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "messageId" VARCHAR(100),
ADD COLUMN     "patientId" UUID;

-- CreateIndex
CREATE INDEX "reminders_patientId_idx" ON "reminders"("patientId");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
