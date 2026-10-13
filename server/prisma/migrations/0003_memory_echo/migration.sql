-- CreateEnum
CREATE TYPE "EchoType" AS ENUM ('ON_THIS_DAY', 'COPY_ANNIVERSARY', 'COPY_MILESTONE', 'COPY_FIRST', 'PAST_AND_NOW', 'TOPIC_MEMORY');

-- CreateEnum
CREATE TYPE "EchoStatus" AS ENUM ('ACTIVE', 'DISMISSED');

-- AlterTable
ALTER TABLE "Memory" ADD COLUMN "echoExcluded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN "echoEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MemoryEcho" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "comparisonMemoryId" TEXT,
    "longTermCopyId" TEXT,
    "echoDate" DATE NOT NULL,
    "echoType" "EchoType" NOT NULL,
    "reason" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "status" "EchoStatus" NOT NULL DEFAULT 'ACTIVE',
    "viewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryEcho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EchoReflection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "memoryEchoId" TEXT,
    "sourceEchoDate" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EchoReflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EchoPreference" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "excludedMoods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EchoPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemoryEcho_userId_echoDate_memoryId_key" ON "MemoryEcho"("userId", "echoDate", "memoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryEcho_userId_echoDate_displayOrder_key" ON "MemoryEcho"("userId", "echoDate", "displayOrder");

-- CreateIndex
CREATE INDEX "MemoryEcho_userId_echoDate_idx" ON "MemoryEcho"("userId", "echoDate" DESC);

-- CreateIndex
CREATE INDEX "MemoryEcho_memoryId_createdAt_idx" ON "MemoryEcho"("memoryId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryEcho_comparisonMemoryId_idx" ON "MemoryEcho"("comparisonMemoryId");

-- CreateIndex
CREATE UNIQUE INDEX "EchoReflection_memoryEchoId_key" ON "EchoReflection"("memoryEchoId");

-- CreateIndex
CREATE INDEX "EchoReflection_userId_memoryId_sourceEchoDate_idx" ON "EchoReflection"("userId", "memoryId", "sourceEchoDate" DESC);

-- AddForeignKey
ALTER TABLE "MemoryEcho" ADD CONSTRAINT "MemoryEcho_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEcho" ADD CONSTRAINT "MemoryEcho_comparisonMemoryId_fkey" FOREIGN KEY ("comparisonMemoryId") REFERENCES "Memory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEcho" ADD CONSTRAINT "MemoryEcho_longTermCopyId_fkey" FOREIGN KEY ("longTermCopyId") REFERENCES "LongTermCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EchoReflection" ADD CONSTRAINT "EchoReflection_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EchoReflection" ADD CONSTRAINT "EchoReflection_memoryEchoId_fkey" FOREIGN KEY ("memoryEchoId") REFERENCES "MemoryEcho"("id") ON DELETE SET NULL ON UPDATE CASCADE;
