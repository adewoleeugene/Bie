-- CreateEnum
CREATE TYPE "MessageRefType" AS ENUM ('USER', 'TASK', 'WIKI_PAGE');

-- CreateTable
CREATE TABLE "MessageReference" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "targetType" "MessageRefType" NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "MessageReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageReference_messageId_idx" ON "MessageReference"("messageId");

-- CreateIndex
CREATE INDEX "MessageReference_targetType_targetId_idx" ON "MessageReference"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "MessageReference" ADD CONSTRAINT "MessageReference_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
