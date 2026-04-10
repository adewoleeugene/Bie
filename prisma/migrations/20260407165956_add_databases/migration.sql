-- CreateEnum
CREATE TYPE "DatabasePropertyType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'DATE', 'CHECKBOX', 'PERSON', 'URL', 'EMAIL');

-- CreateEnum
CREATE TYPE "DatabaseViewType" AS ENUM ('TABLE', 'BOARD', 'GALLERY', 'CALENDAR');

-- CreateTable
CREATE TABLE "WikiDatabase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatabaseProperty" (
    "id" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DatabasePropertyType" NOT NULL,
    "config" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatabaseProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatabaseRow" (
    "id" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatabaseValue" (
    "id" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "DatabaseValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatabaseView" (
    "id" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DatabaseViewType" NOT NULL,
    "config" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatabaseView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WikiDatabase_organizationId_idx" ON "WikiDatabase"("organizationId");

-- CreateIndex
CREATE INDEX "DatabaseProperty_databaseId_idx" ON "DatabaseProperty"("databaseId");

-- CreateIndex
CREATE INDEX "DatabaseRow_databaseId_idx" ON "DatabaseRow"("databaseId");

-- CreateIndex
CREATE INDEX "DatabaseValue_propertyId_idx" ON "DatabaseValue"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "DatabaseValue_rowId_propertyId_key" ON "DatabaseValue"("rowId", "propertyId");

-- CreateIndex
CREATE INDEX "DatabaseView_databaseId_idx" ON "DatabaseView"("databaseId");

-- AddForeignKey
ALTER TABLE "WikiDatabase" ADD CONSTRAINT "WikiDatabase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiDatabase" ADD CONSTRAINT "WikiDatabase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseProperty" ADD CONSTRAINT "DatabaseProperty_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "WikiDatabase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseRow" ADD CONSTRAINT "DatabaseRow_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "WikiDatabase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseValue" ADD CONSTRAINT "DatabaseValue_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "DatabaseRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseValue" ADD CONSTRAINT "DatabaseValue_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "DatabaseProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseView" ADD CONSTRAINT "DatabaseView_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "WikiDatabase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
