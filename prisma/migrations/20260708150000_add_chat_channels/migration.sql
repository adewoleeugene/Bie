-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DM', 'GROUP', 'CHANNEL');

-- AlterTable
ALTER TABLE "Conversation"
ADD COLUMN "type" "ConversationType" NOT NULL DEFAULT 'DM',
ADD COLUMN "topic" TEXT,
ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "createdById" TEXT;

-- Backfill existing group chats before dropping the legacy boolean.
UPDATE "Conversation"
SET "type" = CASE WHEN "isGroup" THEN 'GROUP'::"ConversationType" ELSE 'DM'::"ConversationType" END;

ALTER TABLE "Conversation" DROP COLUMN "isGroup";

-- Indexes
CREATE INDEX "Conversation_organizationId_type_idx" ON "Conversation"("organizationId", "type");

-- Backfill one public #general channel per organization.
WITH owner_candidates AS (
    SELECT DISTINCT ON ("organizationId")
        "organizationId",
        "userId"
    FROM "OrganizationMember"
    WHERE "role" IN ('OWNER', 'ADMIN', 'MEMBER')
    ORDER BY
        "organizationId",
        CASE "role" WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,
        "joinedAt" ASC
),
created_channels AS (
    INSERT INTO "Conversation" (
        "id",
        "type",
        "name",
        "topic",
        "isPrivate",
        "archived",
        "createdById",
        "organizationId",
        "createdAt",
        "updatedAt"
    )
    SELECT
        concat('general_', oc."organizationId"),
        'CHANNEL'::"ConversationType",
        'general',
        'Workspace-wide conversation',
        false,
        false,
        oc."userId",
        oc."organizationId",
        NOW(),
        NOW()
    FROM owner_candidates oc
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Conversation" c
        WHERE c."organizationId" = oc."organizationId"
          AND c."type" = 'CHANNEL'::"ConversationType"
          AND c."name" = 'general'
    )
    RETURNING "id", "organizationId"
),
general_channels AS (
    SELECT "id", "organizationId"
    FROM created_channels
    UNION
    SELECT c."id", c."organizationId"
    FROM "Conversation" c
    WHERE c."type" = 'CHANNEL'::"ConversationType"
      AND c."name" = 'general'
      AND c."isPrivate" = false
)
INSERT INTO "ConversationMember" ("conversationId", "userId", "joinedAt", "lastReadAt")
SELECT gc."id", om."userId", NOW(), NOW()
FROM general_channels gc
JOIN "OrganizationMember" om ON om."organizationId" = gc."organizationId"
WHERE om."role" <> 'GUEST'
ON CONFLICT ("conversationId", "userId") DO NOTHING;
