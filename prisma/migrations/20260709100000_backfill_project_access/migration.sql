-- Preserve today's default behavior: existing projects remain visible to the org.
UPDATE "Project"
SET "visibility" = 'ORG_VISIBLE'
WHERE "visibility" IS NULL;

-- Ensure project leads have full access before any project is made private.
INSERT INTO "ProjectMember" ("projectId", "userId", "role", "joinedAt")
SELECT "id", "leadId", 'OWNER', NOW()
FROM "Project"
WHERE "leadId" IS NOT NULL
ON CONFLICT ("projectId", "userId") DO UPDATE
SET "role" = CASE
    WHEN "ProjectMember"."role" IN ('OWNER', 'ADMIN') THEN "ProjectMember"."role"
    ELSE 'OWNER'
END;
