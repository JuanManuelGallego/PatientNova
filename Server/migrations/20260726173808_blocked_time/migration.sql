-- CreateTable
CREATE TABLE "blocked_time" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "description" TEXT,
    "startTimeUtc" TIMESTAMP(3) NOT NULL,
    "endTimeUtc" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocked_time_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blocked_time_userId_idx" ON "blocked_time"("userId");
