ALTER TABLE "public"."Memory"
ADD COLUMN "title" TEXT NOT NULL DEFAULT '',
ADD COLUMN "mood" TEXT NOT NULL DEFAULT '';

ALTER TABLE "public"."Memory"
DROP COLUMN "isPending";

ALTER TABLE "public"."Topic"
ADD COLUMN "suppressLongTermPrompt" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."LongTermCopy"
ADD COLUMN "autoCollectEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "LongTermCopy_userId_topicId_key"
ON "public"."LongTermCopy"("userId", "topicId");
