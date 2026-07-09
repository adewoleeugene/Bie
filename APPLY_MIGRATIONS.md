# Apply Migrations to the DB (remediation)

Verification found the DB is missing all chat-channel schema and the project-lead
backfill never ran. The code is correct; the DB was never migrated.

## ⚠️ Do NOT use `prisma db push` for this

`db push` syncs structure only. It would **drop `isGroup` without backfilling
`type`** (every existing GROUP chat silently becomes a DM), and it would **skip
`#general` seeding and the project-lead backfill** entirely. Data loss + missing
setup.

## Correct approach: run the migration SQL files directly, in order

Execute each file's SQL against the database (Neon SQL editor, `psql`, or
`run_sql`) **in this exact order**. Each is written against the current DB state
(which still has `isGroup`), so they apply cleanly and preserve data:

1. `prisma/migrations/20260708150000_add_chat_channels/migration.sql`
   — creates `ConversationType`, adds channel columns, **backfills `type` from
   `isGroup`**, drops `isGroup`, seeds `#general` per org + members.
2. `prisma/migrations/20260708153000_add_message_references/migration.sql`
   — creates `MessageRefType` + `MessageReference`.
3. `prisma/migrations/20260708154500_add_message_edit_delete/migration.sql`
   — adds `Message.deletedAt`.
4. `prisma/migrations/20260709100000_backfill_project_access/migration.sql`
   — defaults project visibility + **backfills project leads as OWNER members**.

Run them one at a time and stop if any errors — do not continue past a failure.

## Then re-verify

Re-run **Part A** and **Part B** from `VERIFICATION_CHECKLIST.md`. Expected now:
- A: all columns/tables/enums present.
- B: `general_channels >= orgs` (should be ≥ 4); `leads_as_members == projects_with_lead` (== 2); `null_visibility == 0`; conversation `type` counts show GROUP preserved (not all DM).

Only once A and B pass, run **Part C** (behavioral: private project invisible to
non-members across board/search/chat, writes Forbidden, Viewer/Editor/Full levels).

## Report back
Paste the re-run outputs of Part A + Part B, then the Part C checklist.
If any migration file errors on execution, paste the error and the file/line —
do not force past it.
