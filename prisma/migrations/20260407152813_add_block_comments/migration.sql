-- CreateTable
CREATE TABLE "BlockComment" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "parentCommentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockComment_pageId_blockId_idx" ON "BlockComment"("pageId", "blockId");

-- CreateIndex
CREATE INDEX "BlockComment_authorId_idx" ON "BlockComment"("authorId");

-- AddForeignKey
ALTER TABLE "BlockComment" ADD CONSTRAINT "BlockComment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockComment" ADD CONSTRAINT "BlockComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockComment" ADD CONSTRAINT "BlockComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "BlockComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
