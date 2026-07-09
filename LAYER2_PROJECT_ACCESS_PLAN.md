# Layer 2: Project Access Control (full Notion mirror)

Give projects real, restrictable access — like Notion teamspaces + pages — with
**per-member access levels**, enforced on **both reads and writes**. A project
can be hidden from members entirely, or shared at a specific level (view /
comment / edit / full). Everything (task board, lists, search, chat) routes
through **one shared access rule**.

## Goal & principle

- **Two dimensions, like Notion:**
  1. **Visibility** — who can *see* the project (org-visible vs private).
  2. **Capability** — what a person can *do* once they have access
     (View / Comment / Edit / Full access).
- **Open by default, restrictable by exception.** Most projects stay org-visible;
  sensitive ones are locked to explicit members at explicit levels.
- **One source of truth.** All decisions go through a single helper + a single
  reusable Prisma filter. Reads *and* mutations enforce it.
- **No regression.** Migration defaults every existing project to org-visible,
  and enforcement must preserve today's "members can edit org work" behavior.

## Existing pieces to reuse (do NOT reinvent)

- `src/lib/permissions.ts` already implements this pattern for **wiki
  pages/databases**: `resolveAccess(resource, viewer)` returns
  `"none" | "view" | "edit"` using `ResourceVisibility` (ORG / ORG_VIEW /
  PRIVATE) + `ResourceMemberRole` (VIEWER / EDITOR) + org ADMIN/OWNER override.
  **Mirror and extend this for projects** (add the "manage" and, if adopted,
  "comment" levels).
- `Project.visibility` (`ORG_VISIBLE` / `PRIVATE`) and `ProjectMember` with
  `ProjectRole` (OWNER / ADMIN / EDITOR / VIEWER) already exist — largely just
  **unenforced**. Reuse these roles as the capability levels.
- `resolveChannelAccess` (chat) is the same shape — keep the style consistent.

## Access levels (map Notion → Bie)

| Notion level | Bie level | Can do |
|---|---|---|
| Full access | `OWNER` / `ADMIN` (ProjectRole) | Edit all content **+ manage members, visibility, delete project** |
| Can edit | `EDITOR` | Create/edit/move/delete tasks, sprints, content — **not** manage sharing |
| Can comment | *(see decision below)* | Read + comment on tasks — no content edits |
| Can view | `VIEWER` | Read only |
| No access | — | Cannot see the project or its tasks |

Effective access level = the **highest** of:
1. Org **ADMIN/OWNER** → Full access to everything (admin override, as wiki does).
2. Explicit `ProjectMember` role on that project.
3. If `visibility === ORG_VISIBLE` → every non-guest org member gets at least
   **Edit** (preserves today's behavior where members work on org projects).
   *(If you'd rather org-visible default to view-only, say so — that's a policy
   knob. Default in this plan = Edit, to avoid regressing current behavior.)*

Guests: level comes **only** from an explicit `ProjectMember` row. Never from
org-visibility or admin override.

**Tasks inherit their project's level.** Task with no project → org-level;
non-guest members get Edit, guests get none.

### Decision needed: "Can comment" tier
Bie's `ProjectRole` has no COMMENTER. Two options:
- **(a) Skip it for v1** — use View / Edit / Full only (matches existing wiki
  model exactly, less work). Recommended unless comment-only is a real need.
- **(b) Add `COMMENTER`** to `ProjectRole` + enforce (read + comment, no edit).
Tell me which; the plan assumes **(a)** unless you say otherwise.

## Implementation

### 1. Shared helpers (`permissions.ts`)
- `resolveProjectAccess(project, viewer): AccessLevel` — extend the existing
  `AccessLevel` union to include `"manage"` (and `"comment"` if option b):
  `none < view < (comment) < edit < manage`.
- `canView / canComment / canEdit / canManageProject` boolean helpers.
- `projectAccessWhere(viewer)` — reusable Prisma `where` fragment for **read**
  list queries (org-visible OR explicit member OR org-admin-unfiltered; guest =
  explicit-member-only; unfiled tasks via `projectId: null` for non-guests).

### 2. Enforce on READS (visibility)
**First: enumerate every read.** Grep, list, then gate each:
```
grep -rnE "db\.(task|project|sprint|milestone|comment|timeEntry|focusSession)\.(findMany|findFirst|findUnique|count|aggregate|groupBy)" src
```
Surfaces (verify against grep — list is not exhaustive): `getTasks/getTask`,
board/kanban, `getProjects/getProject`, sprintboard, My Day, dashboard,
analytics, global search, and **chat** `searchChatReferences` +
`hydrateMessageReferences` (unauthorized task → excluded from search; card
renders **generic**, never leaks title/status/assignees).

### 3. Enforce on WRITES (capability) — the part that was missing
**Enumerate every mutation** and gate by required level:
```
grep -rnE "db\.(task|project|sprint|milestone|comment|taskAssignee|timeEntry)\.(create|update|delete|updateMany|deleteMany|upsert)" src
```
- Create / update / move / delete **task**, sprint, status column, assignees →
  require **Edit** on the task's project.
- Add comment on a task → require **Comment** (or View, if option a) on its project.
- Edit project settings, change visibility, add/remove members & set their level,
  delete/archive project → require **Full access** (manage).
- Return a clean "Forbidden" from the server action (never rely on UI hiding
  alone). Board drag-drop, quick-edit, bulk actions all call these — so gating
  the actions covers the UI automatically.

### 4. UI
- **Project settings → Share:** Notion-style access panel — set project
  Org-visible vs Private, add members, and pick each member's level
  (View / Edit / Full [/ Comment]). Reuse the wiki share UI if one exists.
- Hide inaccessible projects from all lists/pickers (falls out of the read filter).
- Downgrade controls in the UI by level (e.g. a Viewer sees no "New task"
  button) — but the **server action is the real gate**.

### 5. Migration / backfill (`prisma db push` per Neon workflow)
- Default all existing projects to `ORG_VISIBLE`.
- Ensure each project's creator/lead is a `ProjectMember` at `OWNER` so private
  projects always have a full-access owner and no one is locked out.
- No task data changes; tasks inherit via project.

### 6. Edge cases
- **Notifications/links** to an inaccessible task → target page 403s/redirects
  gracefully (also closes the chat-mention concern).
- **Admin override** on both read and write (org admin/owner = Full everywhere).
- **Guest** = explicit-member-only, at their assigned level.
- **Unfiled tasks** (`projectId: null`) stay org-editable for non-guests.
- A member **downgraded** mid-session must lose write ability on next action
  (server-checked every time — no cached grant).

## Chat inherits this for free
Once chat's task search + card hydration + any task writes route through the
shared rule, the earlier "finding #4" closes automatically — zero chat-specific
permission code.

## Constraints
- Reuse existing patterns (`permissions.ts`, server actions, org-role resolution).
  Do **not** build a parallel permission system.
- Enforce in **server actions**, not just UI.
- Keep `npx tsc --noEmit` at **0 errors**.
- Do not commit; leave changes in the working tree.
- Deliver a summary of **every read and write surface changed**, so coverage is
  auditable (this is a security feature — completeness is the whole point).
