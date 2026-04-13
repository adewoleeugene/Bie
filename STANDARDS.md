# ChristBase Standards and Best Practices

**DPG Standard Criterion 8: Adherence to Standards and Best Practices**
**Effective Date:** April 13, 2026
**Last Updated:** April 13, 2026

This document describes the standards, conventions, and engineering
best-practices used in ChristBase.

## Web and Interoperability Standards

### HTTP and JSON

ChristBase uses standard web delivery and API conventions based on HTTP and
JSON for server interactions and report endpoints.

- **Evidence:** `src/app/api/`

### CSV and PDF export formats

For portability of user-created work content, ChristBase exports data using
common non-proprietary formats.

- **CSV:** `src/lib/export.ts`
- **PDF:** `src/components/wiki/wiki-page-view.tsx`

### OAuth-based authentication

Google sign-in is supported through standard OAuth flows managed by NextAuth.

- **Evidence:** `src/lib/auth.ts`, `.env.example`

## Accessibility and Inclusive Design

ChristBase relies on semantic HTML and accessible UI primitives from Radix UI
and Next.js application patterns.

- Keyboard-accessible dialogs, menus, sheets, popovers, checkboxes, and other
  primitives are implemented under `src/components/ui/`
- Accessibility commitments are documented in `DO_NO_HARM.md`

The target practice baseline is alignment with WCAG-oriented accessibility
patterns for keyboard access, focus visibility, labels, and semantic structure.

## Security Best Practices

### Authentication and password handling

- Passwords are hashed with `bcryptjs`
- Authentication and session management are implemented with NextAuth
- Environment-based secrets are documented in `.env.example`

**Evidence:** `src/lib/auth.ts`, `.env.example`, `SECURITY.md`

### Least-privilege tenant scoping

The application uses organization-scoped data access to prevent cross-tenant
leakage.

- **Evidence:** `prisma/schema.prisma`, `src/actions/`, `README.md`

### Responsible disclosure

The repository includes a public vulnerability disclosure process and response
timeline.

- **Evidence:** `SECURITY.md`

## Engineering Quality Practices

### Type safety

ChristBase uses TypeScript in strict mode.

- **Evidence:** `tsconfig.json`, `package.json`

### Schema-driven data layer

The data model is defined in Prisma schema files and versioned migrations.

- **Evidence:** `prisma/schema.prisma`, `prisma/migrations/`

### Linting and repository conventions

- ESLint is configured and exposed through `npm run lint`
- Contribution expectations are documented in `CONTRIBUTING.md`
- Repository ownership is documented in `AUTHORS.md` and `.github/CODEOWNERS`

**Evidence:** `eslint.config.mjs`, `package.json`, `CONTRIBUTING.md`,
`.github/CODEOWNERS`, `AUTHORS.md`

## Privacy and Data Protection Practices

ChristBase documents GDPR-aligned privacy commitments and explains data
handling, retention, deletion, and third-party processors.

- **Evidence:** `PRIVACY.md`, `DO_NO_HARM.md`

The application also implements a structured privacy-request workflow and
role-restricted review path for export and deletion handling.

- **Evidence:** `src/actions/privacy.ts`, `src/components/settings/privacy-controls.tsx`,
  `src/components/settings/privacy-admin-panel.tsx`

## Reference Standards and Principles

ChristBase is developed with reference to the following widely adopted standards
and best-practice categories:

- HTTP/HTTPS for web transport
- JSON, CSV, and PDF for interoperable data exchange
- OAuth 2.0 / OIDC-style delegated authentication via Google and NextAuth
- WCAG-aligned accessibility practices for the web
- OWASP-style secure development and disclosure practices
- Open-source licensing via AGPL-3.0-or-later

## Continuous Improvement

Standards alignment is reviewed as new features are added. Where a standard is
described in policy documentation, the expectation is that the implementation is
kept consistent with the codebase and deployment configuration.
