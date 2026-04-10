-- CreateTable
CREATE TABLE "DailyReflection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "mood" INTEGER,
    "energyLevel" INTEGER,
    "highlights" TEXT,
    "improvements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiPageAnalytics" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiPageAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReflection_userId_idx" ON "DailyReflection"("userId");

-- CreateIndex
CREATE INDEX "DailyReflection_organizationId_idx" ON "DailyReflection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReflection_userId_date_key" ON "DailyReflection"("userId", "date");

-- CreateIndex
CREATE INDEX "WikiPageAnalytics_pageId_idx" ON "WikiPageAnalytics"("pageId");

-- CreateIndex
CREATE INDEX "WikiPageAnalytics_userId_idx" ON "WikiPageAnalytics"("userId");

-- CreateIndex
CREATE INDEX "WikiPageAnalytics_pageId_userId_idx" ON "WikiPageAnalytics"("pageId", "userId");

-- AddForeignKey
ALTER TABLE "DailyReflection" ADD CONSTRAINT "DailyReflection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReflection" ADD CONSTRAINT "DailyReflection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPageAnalytics" ADD CONSTRAINT "WikiPageAnalytics_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPageAnalytics" ADD CONSTRAINT "WikiPageAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
