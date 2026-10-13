ALTER TABLE "MemoryEcho" ADD COLUMN "sourceTopicId" TEXT;

CREATE TABLE "EchoGeneration" (
  "userId" TEXT NOT NULL,
  "echoDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EchoGeneration_pkey" PRIMARY KEY ("userId", "echoDate")
);

CREATE INDEX "MemoryEcho_sourceTopicId_idx" ON "MemoryEcho"("sourceTopicId");
CREATE INDEX "EchoGeneration_echoDate_idx" ON "EchoGeneration"("echoDate");

ALTER TABLE "MemoryEcho" ADD CONSTRAINT "MemoryEcho_sourceTopicId_fkey" FOREIGN KEY ("sourceTopicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
