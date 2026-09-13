-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'GOOGLE_CONNECTION';
ALTER TYPE "EntityType" ADD VALUE 'GOOGLE_MEET_SPACE';

-- CreateTable
CREATE TABLE "google_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT,
    "grantedScopes" TEXT[],
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_oauth_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "returnPath" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_connections_userId_key" ON "google_connections"("userId");

-- CreateIndex
CREATE INDEX "google_connections_userId_idx" ON "google_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "google_oauth_states_stateHash_key" ON "google_oauth_states"("stateHash");

-- CreateIndex
CREATE INDEX "google_oauth_states_userId_idx" ON "google_oauth_states"("userId");

-- CreateIndex
CREATE INDEX "google_oauth_states_expiresAt_idx" ON "google_oauth_states"("expiresAt");

-- AddForeignKey
ALTER TABLE "google_connections" ADD CONSTRAINT "google_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_oauth_states" ADD CONSTRAINT "google_oauth_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
