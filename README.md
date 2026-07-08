# ChristBase

All-in-one project management and productivity platform for Christex Foundation. Built with Next.js and deployable as both a web app (Vercel) and a desktop app (Electron).

## Features

### Task Management
- Kanban board with drag-and-drop (dnd-kit) across 5 status columns
- Table view with sorting and filtering by status, priority, assignee, and date range
- Task detail sheets with rich description editor, subtasks, comments, and activity audit trail
- Priority levels (P0-P3), multi-assignee support, due dates, and file attachments

### Projects & Sprints
- Per-project dashboards with board, table, calendar, timeline, backlog, and sprint views
- Sprint planning and velocity tracking
- Automation rules per project

### Wiki & Knowledge Base
- Hierarchical wiki pages with BlockNote rich-text editor
- Page versioning, icons, cover images, and published/private visibility
- Mentions (@user, @date, @page), block-level threaded comments, and backlinks
- Wiki templates and page analytics (views, viewers)

### Custom Databases
- Notion-style databases with 14 property types (text, number, select, multi-select, date, checkbox, person, URL, email, image, relation, rollup, status, formula)
- Table, board, gallery, calendar, and timeline views
- Row detail sheets with relations and rollups

### Focus & Pomodoro
- Pomodoro timer (25-min sessions) linked to tasks
- Focus session history and duration tracking

### Time Tracking
- Manual and automatic time entries tied to tasks
- Estimate vs. actual comparison

### Daily Planner
- "My Day" view for planning the current day's work
- AI-assisted plan picker

### Analytics
- Task completion trends, status distribution, sprint velocity
- Team productivity metrics and project progress
- Date range filtering and export

### AI Assistant
- Streaming chat assistant (BieAI) with natural language task creation
- Voice input support and task name resolution

### Chat & Messaging
- Group conversations and direct messages
- Real-time updates via SSE streaming

### Squads
- Team/squad management with member assignment

### Search, Favorites & Recents
- Global search across tasks, projects, wiki pages
- Favorites and recent items in the sidebar

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL + Prisma 7 |
| Auth | NextAuth.js v5 (Google OAuth + email/password) |
| UI | Tailwind CSS 4 + shadcn/ui + Radix UI |
| Rich Editor | BlockNote |
| Charts | Recharts |
| Drag & Drop | dnd-kit |
| State | TanStack Query v5 |
| Validation | Zod + React Hook Form |
| AI | AI SDK (@ai-sdk/react) |
| Desktop | Electron 40 + electron-builder |
| Hosting | Vercel + managed Postgres |

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Google OAuth credentials (for Google sign-in)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/christbase?schema=public"

AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

AUTH_SECRET="your-secret-key"
AUTH_URL="http://localhost:3000"
```

For Google OAuth setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add the authorized redirect URI that matches your local `AUTH_URL` exactly:
   - If `AUTH_URL="http://localhost:3000"`, add `http://localhost:3000/api/auth/callback/google`
   - If `AUTH_URL="http://localhost:3004"`, add `http://localhost:3004/api/auth/callback/google`

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`
are also supported for older local environments.

### 3. Initialize the database

```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

### 4. Run the app

```bash
# Web
npm run dev

# Desktop (Electron)
npm run dev:desktop
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run dev:desktop` | Start dev server + Electron |
| `npm run build` | Production build (generates Prisma client + Next.js build) |
| `npm run build:desktop` | Build + package Electron app |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login & signup pages
│   ├── (dashboard)/         # All authenticated routes
│   │   ├── dashboard/       # Home dashboard
│   │   ├── my-day/          # Daily planner
│   │   ├── projects/        # Projects with sub-views
│   │   ├── sprintboard/     # Sprint kanban board
│   │   ├── wiki/            # Wiki pages
│   │   ├── databases/       # Custom databases
│   │   ├── focus/           # Pomodoro & focus sessions
│   │   ├── time-tracking/   # Time entries
│   │   ├── analytics/       # Charts & metrics
│   │   ├── squads/          # Team management
│   │   ├── chat/            # Messaging
│   │   ├── settings/        # User & org settings
│   │   └── trash/           # Soft-deleted items
│   ├── api/                 # Auth, AI, and chat endpoints
│   └── published-wiki/      # Public wiki access
├── actions/                 # Server actions (25+)
├── components/              # React components (100+)
│   ├── ui/                  # shadcn/ui primitives
│   ├── kanban/              # Board, column, task card
│   ├── tasks/               # Task detail, comments, filters
│   ├── wiki/                # Editor, sidebar, page view
│   ├── databases/           # Database views & cells
│   ├── focus/               # Pomodoro timer, session list
│   ├── analytics/           # Charts & metric cards
│   ├── ai/                  # Assistant chat
│   └── layout/              # Sidebar, top nav, providers
├── hooks/                   # Custom hooks (20+, TanStack Query)
├── lib/                     # Auth, DB, validators, utils, AI/NLP
└── types/                   # TypeScript type definitions
prisma/
├── schema.prisma            # 38 models with multi-tenancy
├── migrations/              # Database migrations
└── seed.ts                  # Seed script
```

## Architecture

- **Multi-tenant**: All queries scoped by `organizationId`
- **Server Components by default**: `"use client"` only where interactivity is needed
- **Server Actions for mutations**: No traditional API routes for CRUD
- **ActionResult pattern**: `{ success: boolean; data: T; error?: string }`
- **Zod validation** on all server action inputs
- **Optimistic UI** with TanStack Query for instant feedback and rollback
- **Soft deletes** via `deletedAt` for recoverable deletion
- **38 Prisma models** covering tasks, wiki, databases, focus, time tracking, chat, notifications, and more

## Coding Conventions

- `@/` path alias for all imports
- `kebab-case` filenames, `PascalCase` components, `camelCase` functions
- Tailwind + shadcn/ui for styling (no custom CSS files beyond `globals.css`)

## Development Workflow

1. Make changes
2. If the Prisma schema changed: `npx prisma migrate dev`
3. Test locally: `npm run dev`
4. Build: `npm run build`
5. Deploy to Vercel

## Troubleshooting

**Database connection issues** - Verify `DATABASE_URL` in `.env` and ensure PostgreSQL is running.

**Google OAuth not working** - Check that the redirect URI matches exactly and credentials are correct.

**Build errors** - Run `npx prisma generate`, then clear `.next` (`rm -rf .next`) and retry.

## DPG Alignment Documents

The following repository documents are maintained to support evaluation against
the Digital Public Goods Standard:

- [SDG_ALIGNMENT.md](./SDG_ALIGNMENT.md) - SDG relevance and feature mapping
- [AUTHORS.md](./AUTHORS.md) - ownership and maintainership
- [CONTRIBUTING.md](./CONTRIBUTING.md) - contribution process
- [SECURITY.md](./SECURITY.md) - vulnerability disclosure process
- [PRIVACY.md](./PRIVACY.md) - privacy and data handling commitments
- [DATA_EXTRACTION.md](./DATA_EXTRACTION.md) - non-proprietary data export mechanisms
- [STANDARDS.md](./STANDARDS.md) - standards and best-practices alignment
- [DO_NO_HARM.md](./DO_NO_HARM.md) - harm mitigation and safety assessment

## License

ChristBase is licensed under the GNU Affero General Public License v3.0 or
later. See [LICENSE](./LICENSE).
