# SDG Alignment: ChristBase

ChristBase is an open-source, all-in-one project management and productivity platform built for Christex Foundation. This document maps its features to the United Nations Sustainable Development Goals (SDGs).

---

## SDG 4 — Quality Education

**Target**: Ensure inclusive and equitable quality education and promote lifelong learning opportunities for all.

ChristBase provides structured knowledge management tools that support organizational learning and documentation.

| Feature | Description | Codebase Reference |
|---|---|---|
| Wiki / Knowledge Base | A full wiki system with page creation, editing, nested hierarchies, and a sidebar for navigation. Enables teams to build and maintain shared knowledge repositories. | `src/app/(dashboard)/wiki/`, `src/components/wiki/wiki-page-view.tsx`, `src/components/wiki/wiki-sidebar.tsx` |
| Project-scoped Wikis | Each project can maintain its own wiki, allowing contextual documentation tied to specific initiatives. | `src/app/(dashboard)/projects/[projectId]/wiki/` |
| Published Wiki | Wiki content can be published externally, making organizational knowledge accessible beyond the team. | `src/app/published-wiki/page.tsx` |
| Search | A search dialog that allows quick discovery of documented knowledge across the platform. | `src/components/search-dialog.tsx` |
| Daily Reflections | A reflections feature that encourages regular self-assessment and learning review. | `src/app/(dashboard)/reflections/`, `src/components/daily-planner/` |

---

## SDG 8 — Decent Work and Economic Growth

**Target**: Promote sustained, inclusive and sustainable economic growth, full and productive employment and decent work for all.

ChristBase provides tools that directly improve work management, productivity measurement, and team efficiency.

| Feature | Description | Codebase Reference |
|---|---|---|
| Task Management | Create, assign, prioritize, and track tasks with status workflows, enabling structured work execution. | `src/components/tasks/` |
| Sprint Planning | A sprint board for agile planning, allowing teams to organize work into time-boxed iterations. | `src/app/(dashboard)/sprintboard/`, `src/components/sprints/` |
| Kanban Boards | Visual task boards for workflow management and work-in-progress tracking. | `src/components/kanban/` |
| Time Tracking | Track time spent on tasks and projects, supporting accountability and workload analysis. | `src/app/(dashboard)/time-tracking/`, `src/components/time-tracking/` |
| Productivity Analytics | Dashboards and reports that measure team output, task completion rates, and productivity trends. | `src/app/(dashboard)/analytics/`, `src/components/analytics/`, `src/hooks/use-analytics.ts`, `src/actions/analytics.ts` |
| Focus Mode | A dedicated distraction-free mode for deep work sessions. | `src/app/(dashboard)/focus/`, `src/app/(focus)/layout.tsx`, `src/components/focus/` |
| My Day Planner | A daily planning view that helps individuals prioritize and organize their workday. | `src/app/(dashboard)/my-day/page.tsx`, `src/components/daily-planner/` |
| Milestones | Track project milestones to measure progress toward key deliverables. | `src/actions/milestones.ts`, `src/components/milestones/` |
| Automation | Workflow automation to reduce repetitive manual work. | `src/components/automation/` |

---

## SDG 9 — Industry, Innovation and Infrastructure

**Target**: Build resilient infrastructure, promote inclusive and sustainable industrialization and foster innovation.

ChristBase is open-source digital infrastructure that organizations can self-host and adapt to their needs.

| Feature | Description | Codebase Reference |
|---|---|---|
| Open-Source Platform | The entire platform is open source, allowing any organization to deploy, modify, and extend it. | Repository root, `package.json`, `next.config.ts` |
| Custom Databases | A flexible database builder that lets organizations create structured data stores without external tools. | `src/app/(dashboard)/databases/`, `src/components/databases/database-table-view.tsx` |
| Wiki / Knowledge Base | A self-hosted knowledge management system that replaces proprietary alternatives. | `src/app/(dashboard)/wiki/`, `src/components/wiki/` |
| Project Management Infrastructure | Full project lifecycle management with tasks, sprints, kanban boards, and milestones — infrastructure that organizations typically pay for as SaaS. | `src/app/(dashboard)/projects/`, `src/components/projects/` |
| AI Integration | Optional AI-powered insights and chat features built on open APIs (Cloudflare Workers AI, Google Gemini), demonstrating how organizations can adopt AI tools affordably. | `src/app/(dashboard)/chat/`, `src/components/ai/`, `src/actions/ai-insights.ts` |
| REST API | An API layer (including reports) that allows integration with other systems. | `src/app/api/reports/` |
| Prisma Data Layer | A well-structured, schema-driven data layer that other developers can extend. | `prisma/schema.prisma` |
| Electron Desktop App | A cross-platform desktop application, extending access beyond the browser. | `electron/` |

---

## SDG 17 — Partnerships for the Goals

**Target**: Strengthen the means of implementation and revitalize the global partnership for sustainable development.

ChristBase includes collaboration features that enable teams and organizations to work together effectively.

| Feature | Description | Codebase Reference |
|---|---|---|
| Squads / Team Management | Organize members into squads (teams), enabling structured collaboration across organizational units. | `src/app/(dashboard)/squads/`, `src/components/squads/` |
| Real-time Chat | Built-in messaging for team communication, reducing reliance on external tools. | `src/app/(dashboard)/chat/`, `src/components/chat/` |
| Multi-user Platform | User management, roles, and member administration for multi-tenant collaboration. | `src/app/(dashboard)/users/`, `src/actions/members.ts`, `src/hooks/use-members.ts` |
| Notifications | An in-app notification system that keeps collaborators informed of updates. | `src/components/notifications/`, `src/lib/notifications.ts` |
| Content Sharing | Share wiki pages and project artifacts with configurable visibility. | `src/components/sharing/`, `src/app/published-wiki/page.tsx` |
| File Attachments | Attach and share files within projects and tasks. | `src/components/attachments/` |
| Settings and Permissions | Configurable workspace settings that support organizational governance. | `src/app/(dashboard)/settings/`, `src/components/settings/` |

---

## Summary

| SDG | Primary ChristBase Capability |
|---|---|
| **SDG 4** — Quality Education | Wiki, knowledge base, published documentation, reflections |
| **SDG 8** — Decent Work and Economic Growth | Task management, sprints, time tracking, analytics, focus mode |
| **SDG 9** — Industry, Innovation and Infrastructure | Open-source platform, custom databases, AI integration, APIs |
| **SDG 17** — Partnerships for the Goals | Squads, chat, multi-user collaboration, notifications, sharing |
