# Re-check — realtime delivery + Viewer edit message

Two fixes just landed. Re-verify only these against the migrated Neon DB, then
report results. `npx tsc --noEmit` should be 0 errors.

## Context of the fixes
- `src/lib/chat-events.ts` — LISTEN/NOTIFY now uses a **direct (unpooled)**
  connection. It prefers `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING` /
  `DIRECT_URL`, else derives it from `DATABASE_URL` by removing `-pooler`.
  Reason: Neon's pooled endpoint (PgBouncer transaction mode) silently drops
  async notifications, so realtime never fired.
- `src/actions/task.ts` — a Viewer who tries to edit a task they can see now
  gets "You have view-only access to this task" instead of "Task not found".

## 1. Realtime now delivers (the failure from before)
Preferred: the same backend path you tested last time.
1. Confirm which connection the realtime channel resolves to — log the **host**
   of `realtimeConnectionString()` (mask credentials). It must **NOT** contain
   `-pooler`. If it still does, set `DATABASE_URL_UNPOOLED` to the direct string
   (DATABASE_URL with `-pooler` removed) and retry.
2. In one process/session: `subscribe(conversationId, cb)`.
3. In the same run: `publishChatEvent({ conversationId, type: "message.created", ... })`.
4. Wait up to ~3s for the notification.
   - [ ] `cb` fires with the `message.created` payload  → **PASS**

Also acceptable (stronger): drive the app in two browser sessions on the same
conversation — send in one, confirm it appears in the other **without refresh**.

## 2. Viewer edit message (the polish)
Reuse the Part C fixtures (private project + task, MEMBER added as VIEWER).
- [ ] As VIEWER, invoke `updateTask` on the visible task → error is
      **"You have view-only access to this task"** (NOT "Task not found")
- [ ] As VIEWER, invoke `deleteTask` / `reorderTask` → same view-only message
- [ ] As a **non-member** (not on the project), invoke `updateTask` → still
      **"Task not found"** (unchanged — this is correct, don't "fix" it)

## Report
- Realtime: PASS/FAIL + the resolved host (masked) + whether an env var was needed.
- Viewer message: the exact error strings observed for each case.
- `npx tsc --noEmit`: error count.
