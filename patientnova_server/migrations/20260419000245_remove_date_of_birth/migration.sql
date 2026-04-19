/*
  Warnings:

  - The `birthDate` column on the `medical_records` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `dateOfBirth` on the `patients` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "evolution_notes" ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "medical_records" DROP COLUMN "birthDate",
ADD COLUMN     "birthDate" DATE;

-- AlterTable
ALTER TABLE "patients" DROP COLUMN "dateOfBirth";
