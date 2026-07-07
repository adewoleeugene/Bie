-- Adds the "request edit access" schema for wiki pages.
--
-- This project syncs its schema with `prisma db push` (not `prisma migrate`),
-- so this file is the version-controlled record of the raw change and a manual
-- fallback for applying it directly (e.g. in the Neon SQL console).
--
-- Idempotent: safe to run more than once. Uses the exact index/constraint names
-- Prisma generates, so a later `prisma db push` sees no drift.
-- Target: Postgres 12+ (Neon is PG17).

-- 1. New enum for request state.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccessRequestStatus') THEN
        CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');
    END IF;
END$$;

-- 2. Two new NotificationType values (no-op if already present).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACCESS_GRANTED';

-- 3. The requests table.
CREATE TABLE IF NOT EXISTS "WikiPageAccessRequest" (
    "id"        TEXT NOT NULL,
    "pageId"    TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "status"    "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WikiPageAccessRequest_pkey" PRIMARY KEY ("id")
);

-- 4. Indexes (unique on (pageId,userId) + lookup indexes).
CREATE UNIQUE INDEX IF NOT EXISTS "WikiPageAccessRequest_pageId_userId_key"
    ON "WikiPageAccessRequest"("pageId", "userId");
CREATE INDEX IF NOT EXISTS "WikiPageAccessRequest_pageId_status_idx"
    ON "WikiPageAccessRequest"("pageId", "status");
CREATE INDEX IF NOT EXISTS "WikiPageAccessRequest_userId_idx"
    ON "WikiPageAccessRequest"("userId");

-- 5. Foreign keys (cascade-delete with the page / user), guarded so re-runs
--    don't error on an already-present constraint.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WikiPageAccessRequest_pageId_fkey'
    ) THEN
        ALTER TABLE "WikiPageAccessRequest"
            ADD CONSTRAINT "WikiPageAccessRequest_pageId_fkey"
            FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WikiPageAccessRequest_userId_fkey'
    ) THEN
        ALTER TABLE "WikiPageAccessRequest"
            ADD CONSTRAINT "WikiPageAccessRequest_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;
