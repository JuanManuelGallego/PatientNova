-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" VARCHAR(600),
ADD COLUMN     "professionalLicense" VARCHAR(60),
ADD COLUMN     "publicPhone" VARCHAR(20),
ADD COLUMN     "publicWhatsapp" VARCHAR(20),
ADD COLUMN     "specialty" VARCHAR(120);
