# Part C — Behavioral Verification (run against the migrated DB)

DB schema + backfills are confirmed applied. Now prove the access control
actually behaves. Run the app against the migrated database. **Report a pass/fail
per checkbox; for any fail, give the surface (action/route) + observed vs expected.**

Key rule: for every "cannot" check, confirm it at the **server action**, not just
hidden UI. A hidden button is not a passing test — call the action (via the UI
control, or invoke the server action / its endpoint directly) and confirm it
returns **Forbidden**.

## Setup
Two accounts in the **same org** (use an org that already has projects):
- `OWNER` — org OWNER or ADMIN.
- `MEMBER` — plain org MEMBER, **not** added to the test project.
(Create via the signup/invite flow if they don't exist.)

## 1. Private project is invisible to a non-member
As `OWNER`: create project **"Confidential"**, set visibility **PRIVATE**, add a
task **"Secret task"**. Do NOT add `MEMBER`. Note the task id + project id.

As `MEMBER`, confirm **"Confidential" / "Secret task" do NOT appear** in:
- [ ] Projects list and the project board/kanban
- [ ] Sprintboard
- [ ] My Day
- [ ] Dashboard counts / widgets
- [ ] Analytics
- [ ] Global search / command palette
- [ ] **Chat** — typing `#secret` in the message box returns nothing; the task can't be referenced

## 2. Writes are blocked server-side (not just hidden)
As `MEMBER`, using the ids from step 1, invoke the task **update** and **delete**
actions for "Secret task":
- [ ] update task → **Forbidden**
- [ ] delete task → **Forbidden**
- [ ] create task in "Confidential" → **Forbidden**

## 3. Access levels work (the ladder)
As `OWNER`, add `MEMBER` to "Confidential" as **VIEWER**:
- [ ] `MEMBER` now **sees** "Secret task" in the board + search + chat `#`-search
- [ ] `MEMBER` **cannot edit** it — update/delete/move action → Forbidden

Upgrade `MEMBER` to **EDITOR**:
- [ ] `MEMBER` **can** edit/move "Secret task"
- [ ] `MEMBER` **cannot** change project visibility or add/remove members → Forbidden

(Optional) Set `MEMBER` to project **ADMIN/OWNER**:
- [ ] `MEMBER` can now manage members + visibility

## 4. Chat regressions (from the earlier fixes)
- [ ] A non-member of a **public** channel can find it under **Browse channels** and join it
- [ ] Mentioning a user who is **NOT** in a **private** channel does **not** create a notification for them (check their bell / the Notification table)
- [ ] Real-time works: send a message in one session → it appears in another session (same conversation) without refresh (SSE)
- [ ] `#general` exists for the org and members are auto-joined

## Report
- The checklist above with pass/fail per line.
- For any fail: the action/route, what you did, observed vs expected.
- `npx tsc --noEmit` → confirm 0 errors.
