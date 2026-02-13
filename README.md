# ChristBase - Phase 1 MVP

Internal project management and productivity platform for Christex Foundation.

## 🚀 Phase 1 Features

- ✅ Google OAuth authentication
- ✅ Task CRUD operations
- ✅ Kanban board with drag-and-drop
- ✅ Table view with sorting and filtering
- ✅ Project management
- ✅ Multi-user support
- ✅ Organization-scoped data

## 🛠️ Tech Stack

- **Framework**: Next.js 14+ (App Router, Server Components, Server Actions)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 with Google OAuth
- **UI**: Tailwind CSS + shadcn/ui
- **Drag & Drop**: dnd-kit
- **State Management**: TanStack Query (React Query)
- **Validation**: Zod
- **Hosting**: Vercel + managed Postgres

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Google OAuth credentials

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

Update `.env` with your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/christbase?schema=public"
```

### 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Update `.env`:

```env
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXTAUTH_SECRET="your-secret-key-change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Initialize Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed database with sample data
npx prisma db seed
```

This will create:
- 1 organization (Christex Foundation)
- 8 users
- 3 projects
- 2 sprints
- 20 tasks with random assignments

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

## 📁 Project Structure

```
christbase/
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── migrations/         # Database migrations
│   └── seed.ts            # Seed script
├── src/
│   ├── app/
│   │   ├── (auth)/        # Auth pages (login)
│   │   ├── (dashboard)/   # Protected dashboard pages
│   │   └── api/auth/      # NextAuth API routes
│   ├── components/
│   │   ├── ui/            # shadcn/ui components
│   │   ├── kanban/        # Kanban board components
│   │   ├── tasks/         # Task-related components
│   │   └── layout/        # Layout components
│   ├── lib/
│   │   ├── db.ts          # Prisma client singleton
│   │   ├── auth.ts        # NextAuth configuration
│   │   ├── utils.ts       # Utility functions
│   │   └── validators/    # Zod schemas
│   ├── actions/           # Server actions
│   ├── hooks/             # React hooks (TanStack Query)
│   └── types/             # TypeScript types
└── public/
```

## 🎯 Key Features

### Kanban Board
- Drag-and-drop tasks between columns
- Real-time optimistic updates
- Status-based columns (Backlog, To Do, In Progress, In Review, Done)
- Priority badges and assignee avatars

### Table View
- Sortable by title, priority, due date, status
- Filterable by status and priority
- Assignee avatars
- Due date display

### Task Management
- Create, edit, delete tasks
- Assign to multiple users
- Set priority (P0-P3)
- Set due dates
- Add descriptions
- Link to projects

## 🔒 Security & Architecture

- **Multi-tenant from day one**: All queries scoped by `organizationId`
- **Server-side validation**: Zod schemas on all server actions
- **Type-safe**: TypeScript strict mode, no `any` types
- **Protected routes**: Authentication required for dashboard
- **Optimistic UI**: Instant feedback with rollback on error

## 📝 Coding Conventions

- Server Components by default
- `"use client"` only for interactivity
- Server actions for all mutations (no API routes for CRUD)
- Zod validation on every server action
- ActionResult pattern: `{ success: true; data: T } | { success: false; error: string }`
- Tailwind + shadcn/ui only (no custom CSS)
- `@/` path alias for imports
- `kebab-case` for files, `PascalCase` for components, `camelCase` for functions

## 🚫 What's NOT in Phase 1

- Sprints UI
- Comments
- Wiki/Docs
- Focus timer
- Time tracking
- Analytics
- AI features

These will be added in subsequent phases.

## 📊 Database Schema

16 models with full multi-tenancy support:
- Organization
- User
- OrganizationMember
- Squad & SquadMember
- Project
- Sprint
- Task & TaskAssignee
- Comment
- TaskActivity
- FocusSession
- TimeEntry
- WikiPage & WikiPageVersion
- Notification

## 🔄 Development Workflow

1. Make changes to code
2. Prisma schema changes? Run `npx prisma migrate dev`
3. Test locally with `npm run dev`
4. Build for production: `npm run build`
5. Deploy to Vercel

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [TanStack Query Documentation](https://tanstack.com/query)

## 🐛 Troubleshooting

### Database connection issues
- Verify `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Check firewall settings

### Google OAuth not working
- Verify redirect URI matches exactly
- Check client ID and secret
- Ensure Google+ API is enabled

### Build errors
- Run `npx prisma generate`
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## 📄 License

Internal use only - Christex Foundation
