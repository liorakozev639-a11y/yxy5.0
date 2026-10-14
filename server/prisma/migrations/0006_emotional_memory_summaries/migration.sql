-- CreateEnum
CREATE TYPE "SummaryPeriodType" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "SummaryGenerationStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SummaryGenerationMode" AS ENUM ('AI', 'TEMPLATE');

-- AlterTable
ALTER TABLE "Memory" ADD COLUMN "summaryExcluded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MemorySummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodType" "SummaryPeriodType" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" "SummaryGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "sourceSnapshot" JSONB NOT NULL DEFAULT '{}',
    "sourceHash" TEXT NOT NULL DEFAULT '',
    "generationMode" "SummaryGenerationMode" NOT NULL DEFAULT 'TEMPLATE',
    "isCompact" BOOLEAN NOT NULL DEFAULT false,
    "viewedAt" TIMESTAMP(3),
    "lastViewedPage" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemorySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorySummaryPage" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "narration" TEXT NOT NULL,
    "originalNarration" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "isUserEdited" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemorySummaryPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SummaryReflection" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coverMediaId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SummaryReflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SummaryPreference" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowText" BOOLEAN NOT NULL DEFAULT true,
    "allowPhotos" BOOLEAN NOT NULL DEFAULT true,
    "allowCloudAi" BOOLEAN NOT NULL DEFAULT false,
    "consentReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SummaryPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemorySummary_userId_periodType_periodKey_key" ON "MemorySummary"("userId", "periodType", "periodKey");
CREATE INDEX "MemorySummary_userId_createdAt_idx" ON "MemorySummary"("userId", "createdAt" DESC);
CREATE INDEX "MemorySummary_userId_status_idx" ON "MemorySummary"("userId", "status");
CREATE UNIQUE INDEX "MemorySummaryPage_summaryId_displayOrder_key" ON "MemorySummaryPage"("summaryId", "displayOrder");
CREATE INDEX "MemorySummaryPage_summaryId_idx" ON "MemorySummaryPage"("summaryId");
CREATE UNIQUE INDEX "SummaryReflection_summaryId_key" ON "SummaryReflection"("summaryId");
CREATE INDEX "SummaryReflection_userId_createdAt_idx" ON "SummaryReflection"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "MemorySummaryPage" ADD CONSTRAINT "MemorySummaryPage_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "MemorySummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SummaryReflection" ADD CONSTRAINT "SummaryReflection_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "MemorySummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SummaryReflection" ADD CONSTRAINT "SummaryReflection_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
