# ChristBase -- Do No Harm Assessment

**DPG Standard Criterion 9: Do No Harm**
**Effective Date:** April 13, 2026
**Last Updated:** April 13, 2026

This document describes how ChristBase identifies, mitigates, and monitors potential harms associated with the platform's deployment and use.

---

## 1. Platform Overview and Risk Assessment

ChristBase is a multi-tenant project management platform that provides task tracking, sprint planning, wiki documentation, time tracking, team chat, focus sessions, daily reflections, and an AI-powered assistant. It is designed for teams and organizations managing collaborative work.

### 1.1 Identified Risk Categories

| Risk Category | Severity | Likelihood | Mitigation Status |
|---|---|---|---|
| Unauthorized access to another organization's data | High | Low | Mitigated (see Section 2) |
| Personal data exposure or breach | High | Low | Mitigated (see Sections 2, 3) |
| AI-generated harmful or misleading content | Medium | Low | Mitigated (see Section 6) |
| Harassment or abuse via chat or comments | Medium | Low | Mitigated (see Section 4) |
| Exclusion of users with disabilities | Medium | Medium | Mitigated (see Section 5) |
| Collection of sensitive personal categories | High | N/A | Not applicable (see Section 5.2) |

### 1.2 Intended Use

ChristBase is intended for professional project management, team collaboration, and organizational knowledge management. It is not designed for surveillance, profiling, automated decision-making about individuals, or processing of special-category personal data.

---

## 2. Data Protection Safeguards

### 2.1 Multi-Tenancy Isolation

All database queries are scoped by `organizationId`. A user can only access data belonging to organizations where they hold an active membership. This is enforced at the application layer on every data access path, not only at the UI level.

- **Organization membership** is checked on every authenticated request.
- **Project-level isolation** restricts access to project-scoped resources (tasks, sprints, wiki pages, databases) to project members.
- **Resource-level visibility** (Org-wide vs. Private) and per-resource member roles (Viewer, Editor) provide granular access control within organizations.

### 2.2 Authentication and Authorization

- **Authentication** is handled by NextAuth.js, supporting Google OAuth and email/password credentials.
- **Passwords** are hashed with bcrypt. Plaintext passwords are never stored or logged.
- **Sessions** are managed via secure, HTTP-only session tokens with expiration enforcement.
- **CSRF protection** is built into NextAuth.js via anti-CSRF tokens.
- **Role-based access control** (Owner, Admin, Member) restricts administrative actions to authorized users.

### 2.3 Soft Deletes and Data Recovery

When users delete tasks, wiki pages, or other content, items are soft-deleted (moved to trash). This prevents accidental, irreversible data loss while still honoring deletion intent. Permanently deleted items are removed from the database after a retention window.

### 2.4 Data Minimization

ChristBase collects only the data necessary to provide its features. The platform does not collect device fingerprints, IP-based geolocation profiles, browsing history outside the application, or any data unrelated to project management functionality.

---

## 3. Privacy by Design

ChristBase follows privacy-by-design principles as described in the accompanying [PRIVACY.md](./PRIVACY.md):

- Data is encrypted at rest (database-level encryption) and in transit (TLS).
- OAuth tokens are stored encrypted in the database.
- No advertising trackers, third-party analytics cookies, or cross-site tracking mechanisms are used.
- Users can export selected work data through built-in export features, and may
  submit privacy or deletion requests through the application and published contact channels.
- The platform supports GDPR-aligned rights: access, rectification, portability, erasure, restriction, and objection.

---

## 4. Content Moderation

### 4.1 User-Generated Content

ChristBase hosts user-generated content in several areas: wiki pages, task comments, block-level comments, chat messages, daily reflections, and database records. The platform takes the following approach to content moderation:

- **Organization-level responsibility.** Each organization's Owner and Admin users are responsible for establishing and enforcing acceptable use policies within their tenant. The multi-tenant architecture ensures that content is visible only to members of the relevant organization.
- **Reporting mechanisms.** Organization administrators have the ability to review content, manage memberships, and remove users or content that violates their organization's policies.
- **Audit trail.** Task activity logs and wiki page version history provide a transparent record of who created or modified content and when, supporting accountability.

### 4.2 AI Assistant Content

The AI assistant (powered by Cloudflare Workers AI) generates responses based on user prompts. Content moderation for AI outputs is addressed in Section 6.

---

## 5. Accessibility and Inclusion

### 5.1 Accessibility Approach

ChristBase is built with accessibility as a design consideration:

- **Semantic HTML.** The application uses semantic HTML elements (headings, landmarks, lists, buttons, form labels) to support screen readers and assistive technologies.
- **Keyboard navigation.** Interactive components are keyboard-accessible. The application uses Radix UI primitives, which provide built-in keyboard navigation, focus management, and ARIA attributes.
- **Color contrast.** The UI is built with Tailwind CSS and follows WCAG contrast ratio guidelines. Color is not used as the sole means of conveying information.
- **Responsive design.** The interface adapts to different screen sizes and supports desktop and web usage.
- **Focus indicators.** Interactive elements display visible focus indicators for keyboard users.

We acknowledge that accessibility is an ongoing effort and welcome feedback from users on areas for improvement.

### 5.2 No Collection of Sensitive Categories

ChristBase does **not** collect, process, or infer any of the following categories of personal data:

- Race or ethnic origin
- Religious or philosophical beliefs
- Political opinions
- Trade union membership
- Genetic or biometric data
- Health data
- Sexual orientation
- Criminal records

The daily reflections feature allows users to optionally record mood and personal notes. These entries are private to the user and their organization, are entirely voluntary, and are not analyzed, profiled, or used for any automated decision-making.

---

## 6. AI Safety

### 6.1 Architecture

The AI assistant uses **Cloudflare Workers AI** as its inference provider. User messages and conversation context are sent to the Cloudflare API, which returns generated responses.

### 6.2 Content Filtering

- Cloudflare Workers AI applies its own content filtering and safety policies to model inputs and outputs.
- The AI assistant does not execute autonomous actions. It provides text-based responses only. Any actions (creating tasks, editing wiki pages, etc.) require explicit user confirmation through the standard UI.

### 6.3 No Autonomous Decision-Making

The AI assistant does not:

- Make decisions about user access, permissions, or roles.
- Automatically modify, delete, or publish content without user initiation.
- Profile users or make inferences about personal characteristics.
- Access data outside the user's current organization context.

### 6.4 Transparency

Users are always aware they are interacting with an AI assistant. AI-generated messages are clearly distinguished from human-authored messages in the interface.

### 6.5 Data Handling

AI conversation data (prompts and responses) is stored in the ChristBase database under the same access controls as all other organization data. Cloudflare Workers AI processes data according to Cloudflare's data processing terms. We do not use AI conversation data to train models.

---

## 7. Incident Response

### 7.1 Reporting

Security vulnerabilities, privacy incidents, or safety concerns can be reported to:

- **Security and safety issues:** safety@christex.foundation
- **Privacy concerns:** privacy@christex.foundation

### 7.2 Response Process

1. **Acknowledgment.** Reports are acknowledged within 48 hours.
2. **Assessment.** The reported issue is assessed for severity, scope, and impact.
3. **Containment.** If a confirmed vulnerability or breach is identified, immediate containment actions are taken (e.g., revoking compromised credentials, patching the vulnerability, isolating affected data).
4. **Notification.** Affected users and organizations are notified of material incidents in accordance with applicable data protection laws (e.g., GDPR's 72-hour notification requirement).
5. **Remediation.** A fix or mitigation is developed, tested, and deployed.
6. **Post-incident review.** A root cause analysis is conducted and documented. Systemic improvements are implemented to prevent recurrence.

Privacy and deletion requests submitted through the product are also tracked in
the application with a status lifecycle and can be reviewed by authorized
workspace administrators.

### 7.3 Responsible Disclosure

We support responsible disclosure. Security researchers who identify vulnerabilities are asked to report them to safety@christex.foundation before public disclosure, allowing reasonable time for remediation.

---

## 8. Ongoing Commitment

This assessment is a living document. We review and update it:

- When new features are added that introduce new risk categories.
- When third-party service providers change.
- When incidents occur that reveal gaps in our safeguards.
- At minimum, annually.

---

## 9. Contact

For questions about this assessment or to report concerns:

- **Safety and security:** safety@christex.foundation
- **Privacy:** privacy@christex.foundation
- **Organization:** Christex Foundation
