/*
  Warnings:

  - You are about to drop the `bank_accounts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "bank_accounts" DROP CONSTRAINT "bank_accounts_userId_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bankingKey" TEXT,
ADD COLUMN     "nationalId" TEXT;

-- DropTable
DROP TABLE "bank_accounts";
