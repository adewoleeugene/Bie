# Verification Checklist — Chat Channels + Layer 2 Access

You (Codex) have DB access; the reviewer does not. Run these checks and **report
the actual output of each**, not just "done". Three parts: (A) migrations really
applied, (B) data backfills really ran, (C) access control actually behaves.

---

## ⚠️ Critical gotcha first

This repo uses **`prisma db push`**, which syncs schema **structure only** — it
does **NOT** execute the hand-written **data backfills** inside the migration
files. So even if `db push` was run, these may have silently not happened:
- `isGroup → type` conversion (old group chats default to `DM` instead of `GROUP`)
- `#general` channel seeding + member joins
- Project **lead → `ProjectMember` OWNER** rows (without this, project creators
  can be locked out of their own now-private projects)

Part B exists specifically to catch this. If B fails, run the backfill SQL from
the migration files manually (see remediation).

---

## Part A — Schema structure applied

```sql
SELECT column_name FROM information_schema.columns
  WHERE table_name='Conversation' AND column_name IN ('type','isPrivate','archived','topic','createdById');
-- expect 5 rows

SELECT to_regclass('"MessageReference"') AS message_reference_table;   -- expect non-null
SELECT to_regclass('"ProjectMember"')    AS project_member_table;      -- expect non-null

SELECT column_name FROM information_schema.columns
  WHERE table_name='Message' AND column_name='deletedAt';              -- expect 1 row

SELECT unnest(enum_range(NULL::"ConversationType"))::text;             -- expect DM, GROUP, CHANNEL
SELECT unnest(enum_range(NULL::"ProjectVisibility"))::text;            -- expect ORG_VISIBLE, PRIVATE
```

## Part B — Data backfills ran

```sql
SELECT type, count(*) FROM "Conversation" GROUP BY type;
-- expect CHANNEL rows to exist; existing group chats should be GROUP not all DM

SELECT count(*) AS general_channels FROM "Conversation" WHERE type='CHANNEL' AND name='general';
-- expect >= number of organizations

SELECT count(*) AS orgs FROM "Organization";
-- compare: every org should have a #general

SELECT count(*) AS leads_as_members FROM "ProjectMember" pm
  JOIN "Project" p ON p.id = pm."projectId" AND p."leadId" = pm."userId"
  WHERE pm.role IN ('OWNER','ADMIN');
SELECT count(*) AS projects_with_lead FROM "Project" WHERE "leadId" IS NOT NULL;
-- expect leads_as_members == projects_with_lead

SELECT count(*) AS null_visibility FROM "Project" WHERE "visibility" IS NULL;
-- expect 0
```

**Remediation if B fails:** run the backfill blocks from the migration SQL files
against the DB manually:
- `prisma/migrations/20260708150000_add_chat_channels/migration.sql` (the `#general` + type backfill)
- `prisma/migrations/20260709100000_backfill_project_access/migration.sql` (lead → member)
Then re-run Part B.

## Part C — Behavioral verification (the real test)

Run the app against the migrated DB. Use (or create) **two accounts in the same
org**: `owner@` (OWNER) and `member@` (plain MEMBER, **not** added to the test project).

1. As `owner@`: create a project **"Confidential"**, set visibility **PRIVATE**,
   add a task **"Secret task"**. Do **not** add `member@`.
2. As `member@`, confirm **"Secret task" / "Confidential" do NOT appear** in:
   - [ ] Projects list & the project board/kanban
   - [ ] Sprintboard, My Day, Dashboard, Analytics counts
   - [ ] Global search / command palette
   - [ ] **Chat**: typing `#secret` in the message box returns nothing; the task
         cannot be referenced. A card for it (if pasted) renders **generic**, not
         leaking title/status/assignees.
3. As `member@`, confirm **writes are blocked** (server-side, not just hidden UI):
   attempt to hit the task update/delete action for "Secret task" → **Forbidden**.
4. As `owner@`, add `member@` to the project as **VIEWER**:
   - [ ] `member@` can now **see** "Secret task" everywhere above
   - [ ] `member@` **cannot edit** it (no New Task button; update action → Forbidden)
5. Upgrade `member@` to **EDITOR**:
   - [ ] `member@` can now edit/move the task
   - [ ] `member@` **cannot** change project visibility or manage members (needs Full)
6. Chat sanity (regressions from the earlier fixes):
   - [ ] A non-member of a **public** channel can find it under **Browse channels** and join
   - [ ] Mentioning a user who is **not** in a private channel does **not** notify them
   - [ ] Real-time still works over SSE (send a message in one session, appears in another)

## Report back
For A/B: paste the query outputs. For C: the checklist with pass/fail per line,
and for any failure, the action/route and the observed vs expected behavior.
Also run `npx tsc --noEmit` and confirm 0 errors.
