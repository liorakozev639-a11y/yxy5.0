CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "public"."CopyLifecycleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

CREATE TABLE "public"."MediaAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "captureAt" TIMESTAMP(3),
    "captureSource" TEXT,
    "processingStatus" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Memory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "eventAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "statuses" TEXT[],
    "isPending" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Topic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "isNone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."MemoryTopic" (
    "memoryId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    CONSTRAINT "MemoryTopic_pkey" PRIMARY KEY ("memoryId", "topicId")
);

CREATE TABLE "public"."LongTermCopy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "coverMediaId" TEXT,
    "lifecycleStatus" "public"."CopyLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "LongTermCopy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."LongTermCopyMemory" (
    "copyId" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LongTermCopyMemory_pkey" PRIMARY KEY ("copyId", "memoryId")
);

CREATE INDEX "MediaAsset_userId_createdAt_idx" ON "public"."MediaAsset"("userId", "createdAt");
CREATE UNIQUE INDEX "Memory_mediaId_key" ON "public"."Memory"("mediaId");
CREATE INDEX "Memory_userId_eventAt_idx" ON "public"."Memory"("userId", "eventAt" DESC);
CREATE INDEX "Memory_userId_deletedAt_idx" ON "public"."Memory"("userId", "deletedAt");
CREATE INDEX "Topic_userId_createdAt_idx" ON "public"."Topic"("userId", "createdAt");
CREATE UNIQUE INDEX "Topic_userId_name_key" ON "public"."Topic"("userId", "name");
CREATE INDEX "MemoryTopic_topicId_memoryId_idx" ON "public"."MemoryTopic"("topicId", "memoryId");
CREATE INDEX "LongTermCopy_userId_lifecycleStatus_startDate_idx" ON "public"."LongTermCopy"("userId", "lifecycleStatus", "startDate");
CREATE INDEX "LongTermCopy_topicId_lifecycleStatus_idx" ON "public"."LongTermCopy"("topicId", "lifecycleStatus");
CREATE INDEX "LongTermCopyMemory_copyId_linkedAt_idx" ON "public"."LongTermCopyMemory"("copyId", "linkedAt");

ALTER TABLE "public"."Memory" ADD CONSTRAINT "Memory_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "public"."MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."MemoryTopic" ADD CONSTRAINT "MemoryTopic_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "public"."Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."MemoryTopic" ADD CONSTRAINT "MemoryTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."LongTermCopy" ADD CONSTRAINT "LongTermCopy_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."LongTermCopy" ADD CONSTRAINT "LongTermCopy_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "public"."MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."LongTermCopyMemory" ADD CONSTRAINT "LongTermCopyMemory_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "public"."LongTermCopy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."LongTermCopyMemory" ADD CONSTRAINT "LongTermCopyMemory_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "public"."Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
