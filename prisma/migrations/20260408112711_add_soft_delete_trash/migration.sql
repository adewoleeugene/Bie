-- AlterTable
ALTER TABLE "DatabaseRow" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WikiDatabase" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WikiPage" ADD COLUMN     "deletedAt" TIMESTAMP(3);
