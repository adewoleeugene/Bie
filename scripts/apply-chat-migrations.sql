-- Apply chat-channels + project-access migrations to the database.
-- Combines the 4 migration files in order, wrapped in ONE transaction, with
-- idempotency guards so it is safe to run once OR re-run after a partial run.
-- Preserves the isGroup -> type mapping (which `prisma db push` would destroy).
--
-- Run in the Neon SQL editor (or psql) against the SAME database your app uses.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Chat channels + #general backfill
-- ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationType') THEN
    CREATE TYPE "ConversationType" AS ENUM ('DM', 'GROUP', 'CHANNEL');
  END IF;
END $$;

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "type" "ConversationType" NOT NULL DEFAULT 'DM',
  ADD COLUMN IF NOT EXISTS "topic" TEXT,
  ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "createdById" TEXT;

-- Backfill type from the legacy boolean, then drop it — only if it still exists.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Conversation' AND column_name = 'isGroup'
  ) THEN
    UPDATE "Conversation"
    SET "type" = CASE WHEN "isGroup" THEN 'GROUP'::"ConversationType" ELSE 'DM'::"ConversationType" END;
    ALTER TABLE "Conversation" DROP COLUMN "isGroup";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Conversation_organizationId_type_idx"
  ON "Conversation"("organizationId", "type");

-- One public #general channel per org (guarded: NOT EXISTS + ON CONFLICT).
WITH owner_candidates AS (
    SELECT DISTINCT ON ("organizationId") "organizationId", "userId"
    FROM "OrganizationMember"
    WHERE "role" IN ('OWNER', 'ADMIN', 'MEMBER')
    ORDER BY "organizationId",
        CASE "role" WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,
        "joinedAt" ASC
),
created_channels AS (
    INSERT INTO "Conversation" (
        "id", "type", "name", "topic", "isPrivate", "archived",
        "createdById", "organizationId", "createdAt", "updatedAt"
    )
    SELECT
        concat('general_', oc."organizationId"),
        'CHANNEL'::"ConversationType",
        'general', 'Workspace-wide conversation', false, false,
        oc."userId", oc."organizationId", NOW(), NOW()
    FROM owner_candidates oc
    WHERE NOT EXISTS (
        SELECT 1 FROM "Conversation" c
        WHERE c."organizationId" = oc."organizationId"
          AND c."type" = 'CHANNEL'::"ConversationType"
          AND c."name" = 'general'
    )
    RETURNING "id", "organizationId"
),
general_channels AS (
    SELECT "id", "organizationId" FROM created_channels
    UNION
    SELECT c."id", c."organizationId"
    FROM "Conversation" c
    WHERE c."type" = 'CHANNEL'::"ConversationType"
      AND c."name" = 'general' AND c."isPrivate" = false
)
INSERT INTO "ConversationMember" ("conversationId", "userId", "joinedAt", "lastReadAt")
SELECT gc."id", om."userId", NOW(), NOW()
FROM general_channels gc
JOIN "OrganizationMember" om ON om."organizationId" = gc."organizationId"
WHERE om."role" <> 'GUEST'
ON CONFLICT ("conversationId", "userId") DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. Message references
-- ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageRefType') THEN
    CREATE TYPE "MessageRefType" AS ENUM ('USER', 'TASK', 'WIKI_PAGE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MessageReference" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "targetType" "MessageRefType" NOT NULL,
    "targetId" TEXT NOT NULL,
    CONSTRAINT "MessageReference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MessageReference_messageId_idx"
  ON "MessageReference"("messageId");
CREATE INDEX IF NOT EXISTS "MessageReference_targetType_targetId_idx"
  ON "MessageReference"("targetType", "targetId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageReference_messageId_fkey') THEN
    ALTER TABLE "MessageReference"
      ADD CONSTRAINT "MessageReference_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. Message edit / delete
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Message_deletedAt_idx" ON "Message"("deletedAt");

-- ─────────────────────────────────────────────────────────────
-- 4. Project access backfill (idempotent)
-- ─────────────────────────────────────────────────────────────

UPDATE "Project" SET "visibility" = 'ORG_VISIBLE' WHERE "visibility" IS NULL;

INSERT INTO "ProjectMember" ("projectId", "userId", "role", "joinedAt")
SELECT "id", "leadId", 'OWNER', NOW()
FROM "Project"
WHERE "leadId" IS NOT NULL
ON CONFLICT ("projectId", "userId") DO UPDATE
SET "role" = CASE
    WHEN "ProjectMember"."role" IN ('OWNER', 'ADMIN') THEN "ProjectMember"."role"
    ELSE 'OWNER'
END;

COMMIT;
