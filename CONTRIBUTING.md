# Contributing to ChristBase

Thank you for your interest in contributing to ChristBase. This guide explains how to get started, the conventions we follow, and how to submit your work.

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

## Development Environment Setup

### Prerequisites

- **Node.js** 18 or later
- **PostgreSQL** 14 or later (running locally or via a managed service)
- **npm** (ships with Node.js)

### Getting Started

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/<your-username>/Bie.git
   cd Bie
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example environment file and fill in the required values:

   ```bash
   cp .env.example .env
   ```

   At a minimum you will need a `DATABASE_URL` pointing to your PostgreSQL instance.

4. **Generate the Prisma client**

   ```bash
   npx prisma generate
   ```

5. **Run database migrations**

   ```bash
   npx prisma migrate dev
   ```

6. **Start the development server**

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`.

## Branch Naming Conventions

Use the following prefixes to keep the history easy to navigate:

| Prefix | Purpose |
| --- | --- |
| `feat/` | New features (e.g., `feat/task-templates`) |
| `fix/` | Bug fixes (e.g., `fix/login-redirect`) |
| `docs/` | Documentation changes |
| `refactor/` | Code restructuring with no behavior change |
| `chore/` | Tooling, dependencies, CI updates |
| `test/` | Adding or updating tests |

Keep branch names lowercase and use hyphens to separate words.

## Pull Request Process

1. Create a new branch from `main` using the naming conventions above.
2. Make your changes in small, focused commits with clear messages.
3. Run the linter before pushing:

   ```bash
   npm run lint
   ```

4. Open a pull request against `main`.
5. Fill in the PR template. Describe **what** changed and **why**.
6. Link any related issues (e.g., "Closes #42").
7. At least one maintainer review is required before merging.
8. All CI checks must pass before the PR can be merged.
9. Squash-merge is preferred for feature branches to keep history clean.

## Code Style

### General

- **TypeScript** is used throughout the project with strict mode enabled. Avoid `any` types.
- **Tailwind CSS** with **shadcn/ui** components for all styling. Do not introduce additional CSS frameworks.
- Use **kebab-case** for file and directory names (e.g., `wiki-sidebar.tsx`, `use-analytics.ts`).
- Use **PascalCase** for React component names and type/interface definitions.
- Use **camelCase** for variables, functions, and hooks.

### Project Structure

- `src/app/` -- Next.js App Router pages and layouts
- `src/components/` -- Reusable UI components
- `src/actions/` -- Server actions
- `src/hooks/` -- Custom React hooks
- `src/lib/` -- Shared utilities and helpers
- `prisma/` -- Database schema and migrations

### Prisma / Database

- Add new models to `prisma/schema.prisma` and create a migration with `npx prisma migrate dev --name <description>`.
- Never edit existing migration files. Create a new migration instead.

### Formatting

- Run `npm run lint` and fix any reported issues before committing.
- Keep lines under 100 characters where practical.

## Reporting Bugs

If you find a bug, please [open an issue](https://github.com/adewoleeugene/Bie/issues/new) and include:

1. A clear, descriptive title.
2. Steps to reproduce the problem.
3. What you expected to happen and what actually happened.
4. Browser and OS information if relevant.
5. Screenshots or error logs if available.

## Requesting Features

Feature requests are welcome. [Open an issue](https://github.com/adewoleeugene/Bie/issues/new) and include:

1. A concise description of the feature.
2. The problem it solves or the use case it addresses.
3. Any ideas for how it could be implemented (optional but helpful).

The maintainers will label and triage feature requests. Community discussion on open requests is encouraged.

---

Thank you for helping improve ChristBase. If you have questions about contributing, feel free to open a discussion or reach out to the maintainers at **team@christex.foundation**.
