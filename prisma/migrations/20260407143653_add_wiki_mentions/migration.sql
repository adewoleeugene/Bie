-- CreateEnum
CREATE TYPE "MentionTargetType" AS ENUM ('USER', 'WIKI_PAGE', 'DATE');

-- CreateTable
CREATE TABLE "WikiMention" (
    "id" TEXT NOT NULL,
    "sourcePageId" TEXT NOT NULL,
    "targetType" "MentionTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "blockId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WikiMention_sourcePageId_idx" ON "WikiMention"("sourcePageId");

-- CreateIndex
CREATE INDEX "WikiMention_targetType_targetId_idx" ON "WikiMention"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "WikiMention" ADD CONSTRAINT "WikiMention_sourcePageId_fkey" FOREIGN KEY ("sourcePageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
