-- AlterEnum
ALTER TYPE "DatabasePropertyType" ADD VALUE 'RELATION';

-- CreateTable
CREATE TABLE "DatabaseRowRelation" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fromRowId" TEXT NOT NULL,
    "toRowId" TEXT NOT NULL,

    CONSTRAINT "DatabaseRowRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DatabaseRowRelation_fromRowId_propertyId_idx" ON "DatabaseRowRelation"("fromRowId", "propertyId");

-- CreateIndex
CREATE INDEX "DatabaseRowRelation_toRowId_propertyId_idx" ON "DatabaseRowRelation"("toRowId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "DatabaseRowRelation_propertyId_fromRowId_toRowId_key" ON "DatabaseRowRelation"("propertyId", "fromRowId", "toRowId");

-- AddForeignKey
ALTER TABLE "DatabaseRowRelation" ADD CONSTRAINT "DatabaseRowRelation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "DatabaseProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseRowRelation" ADD CONSTRAINT "DatabaseRowRelation_fromRowId_fkey" FOREIGN KEY ("fromRowId") REFERENCES "DatabaseRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseRowRelation" ADD CONSTRAINT "DatabaseRowRelation_toRowId_fkey" FOREIGN KEY ("toRowId") REFERENCES "DatabaseRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
