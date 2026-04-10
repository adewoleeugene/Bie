-- CreateEnum
CREATE TYPE "ResourceVisibility" AS ENUM ('ORG', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ResourceMemberRole" AS ENUM ('VIEWER', 'EDITOR');

-- AlterEnum
ALTER TYPE "DatabasePropertyType" ADD VALUE 'IMAGE';

-- AlterTable
ALTER TABLE "WikiDatabase" ADD COLUMN     "visibility" "ResourceVisibility" NOT NULL DEFAULT 'ORG';

-- AlterTable
ALTER TABLE "WikiPage" ADD COLUMN     "visibility" "ResourceVisibility" NOT NULL DEFAULT 'ORG';

-- CreateTable
CREATE TABLE "WikiPageMember" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ResourceMemberRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiPageMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiDatabaseMember" (
    "id" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ResourceMemberRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiDatabaseMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WikiPageMember_userId_idx" ON "WikiPageMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiPageMember_pageId_userId_key" ON "WikiPageMember"("pageId", "userId");

-- CreateIndex
CREATE INDEX "WikiDatabaseMember_userId_idx" ON "WikiDatabaseMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiDatabaseMember_databaseId_userId_key" ON "WikiDatabaseMember"("databaseId", "userId");

-- AddForeignKey
ALTER TABLE "WikiPageMember" ADD CONSTRAINT "WikiPageMember_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPageMember" ADD CONSTRAINT "WikiPageMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiDatabaseMember" ADD CONSTRAINT "WikiDatabaseMember_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "WikiDatabase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiDatabaseMember" ADD CONSTRAINT "WikiDatabaseMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
