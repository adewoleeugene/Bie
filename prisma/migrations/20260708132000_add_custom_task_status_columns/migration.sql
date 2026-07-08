-- CreateTable
CREATE TABLE "TaskStatusColumn" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TaskStatus",
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskStatusColumn_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "statusColumnId" TEXT;

-- Backfill default columns for organization-level boards and project boards.
INSERT INTO "TaskStatusColumn" ("id", "name", "status", "color", "sortOrder", "organizationId", "projectId", "createdAt", "updatedAt")
SELECT
    'col_' || md5(scope."organizationId" || ':' || COALESCE(scope."projectId", 'global') || ':' || defaults.status),
    defaults.name,
    defaults.status::"TaskStatus",
    defaults.color,
    defaults.sort_order,
    scope."organizationId",
    scope."projectId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "organizationId", "projectId" FROM "Task"
    UNION
    SELECT "organizationId", NULL::text AS "projectId" FROM "Organization"
    UNION
    SELECT "organizationId", "id" AS "projectId" FROM "Project"
) AS scope
CROSS JOIN (
    VALUES
        ('BACKLOG', 'Backlog', '#858585', 0),
        ('TODO', 'To Do', '#0099ff', 1),
        ('IN_PROGRESS', 'In Progress', '#f6b73c', 2),
        ('IN_REVIEW', 'In Review', '#df5cff', 3),
        ('DONE', 'Done', '#20d990', 4),
        ('ARCHIVED', 'Archived', '#474747', 5)
) AS defaults(status, name, color, sort_order);

-- Link existing tasks to their matching default column in the task scope.
UPDATE "Task" AS task
SET "statusColumnId" = column_match."id"
FROM "TaskStatusColumn" AS column_match
WHERE column_match."organizationId" = task."organizationId"
  AND (
      column_match."projectId" = task."projectId"
      OR (column_match."projectId" IS NULL AND task."projectId" IS NULL)
  )
  AND column_match."status" = task."status";

-- CreateIndex
CREATE INDEX "TaskStatusColumn_organizationId_idx" ON "TaskStatusColumn"("organizationId");

-- CreateIndex
CREATE INDEX "TaskStatusColumn_projectId_idx" ON "TaskStatusColumn"("projectId");

-- CreateIndex
CREATE INDEX "TaskStatusColumn_status_idx" ON "TaskStatusColumn"("status");

-- CreateIndex
CREATE INDEX "Task_statusColumnId_idx" ON "Task"("statusColumnId");

-- AddForeignKey
ALTER TABLE "TaskStatusColumn" ADD CONSTRAINT "TaskStatusColumn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusColumn" ADD CONSTRAINT "TaskStatusColumn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_statusColumnId_fkey" FOREIGN KEY ("statusColumnId") REFERENCES "TaskStatusColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
