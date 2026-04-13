# ChristBase Privacy Policy

**Effective Date:** April 13, 2026
**Last Updated:** April 13, 2026

ChristBase is a multi-tenant project management platform developed by Christex Foundation. This privacy policy explains what data we collect, how we store and protect it, and what rights you have over your information.

---

## 1. Data We Collect

### 1.1 Account Information

When you create an account, we collect:

- **Name** and **email address** (provided directly or via Google OAuth)
- **Profile image URL** (if provided or imported from Google)
- **Hashed password** (for email/password accounts only; we never store plaintext passwords)
- **OAuth tokens** (encrypted; used solely to maintain your authenticated session with Google)

### 1.2 Organization and Membership Data

- Organization name, slug, logo, and billing plan
- Your role within each organization (Owner, Admin, or Member)
- Squad memberships and project assignments

### 1.3 Project and Task Data

- Projects, tasks, sprints, milestones, and their metadata (status, priority, dates, assignments)
- Comments on tasks and block-level comments on documents
- Task activity logs (status changes, assignments, edits)
- File attachments uploaded to tasks, comments, wiki pages, messages, or database rows

### 1.4 Wiki and Database Content

- Wiki pages and their version history (full content snapshots per revision)
- Wiki page analytics (view counts, viewer identity, timestamps)
- Custom databases, their schemas (properties, views), and row-level data
- Wiki templates

### 1.5 Time Tracking and Focus Sessions

- Manual time entries and focus session records (start time, duration, type, break intervals)
- Association of time entries with specific tasks

### 1.6 Chat and Messaging

- Conversations (direct messages and group channels) and their message content
- Conversation membership and read-status metadata

### 1.7 AI Assistant Interactions

- Messages sent to and received from the AI assistant
- Conversation context provided to the AI model to generate responses

### 1.8 Usage and Analytics Data

- Notification records and notification preferences
- Favorites and recently accessed items
- Daily reflections (mood, accomplishments, blockers, goals)
- Automation rules you create

### 1.9 Technical Data

- Session tokens and their expiration timestamps
- Email verification tokens
- Browser-set cookies required for authentication (see Section 7)

---

## 2. How Data Is Stored

### 2.1 Primary Database

All application data is stored in a **PostgreSQL** database. Data is encrypted at rest using the storage-layer encryption provided by the hosting infrastructure. Connections to the database use TLS.

### 2.2 Backups

Database backups are performed on a regular schedule by the infrastructure provider and are encrypted at rest.

### 2.3 Application Hosting

The web application is deployed on **Vercel**. Static assets and server-side functions run on Vercel's edge and serverless infrastructure. Vercel's data handling practices are described in their privacy policy at https://vercel.com/legal/privacy-policy.

---

## 3. Multi-Tenancy and Data Isolation

ChristBase is a multi-tenant platform. Every data query is **scoped by `organizationId`** at the application layer. This means:

- Users can only access data belonging to organizations they are a member of.
- No cross-organization data leakage occurs during normal operation.
- Resource-level visibility controls (Org-wide or Private) and per-resource member roles (Viewer, Editor) provide additional access restrictions within an organization.
- Project-scoped wiki pages and databases are further isolated by project membership.

---

## 4. Third-Party Services

We share data with the following third-party services only as necessary to operate the platform:

| Service | Purpose | Data Shared |
|---|---|---|
| **Google OAuth** (Google Identity) | Authentication | Email, name, profile image (as provided by Google during sign-in) |
| **Cloudflare Workers AI** | AI assistant responses | Messages you send to the AI assistant and surrounding conversation context |
| **Vercel** | Application hosting | All data transiting through the application server |
| **PostgreSQL provider** | Database hosting | All stored application data |

We do not sell your data to any third party. We do not share data with advertisers.

---

## 5. User Rights

We respect your rights over your personal data, consistent with the EU General Data Protection Regulation (GDPR) and similar frameworks:

### 5.1 Right of Access

You may request a copy of the personal data we hold about you. Organization
owners and admins can also export certain organization-level work data through
the platform's built-in export features where available.

### 5.2 Right to Data Portability

ChristBase currently supports built-in export for selected work-product data,
including task data, custom database rows, wiki content, and user-scoped
personal data exports from Settings, using standard formats such as CSV, PDF,
and JSON. Additional portability or personal-data requests can be made through
the contact process below.

The Settings page also includes a tracked privacy-request workflow. Users can
submit export and deletion requests, and each request is stored with status
tracking for operational follow-up.

### 5.3 Right to Rectification

You can update your account information (name, email, profile image) at any time through the Settings page.

### 5.4 Right to Erasure

You may request deletion or anonymization of your personal data, subject to our
legal and organizational record-keeping obligations. ChristBase provides a
tracked deletion-request flow in Settings; requests are reviewed and processed
by maintainers rather than executed immediately as a self-service destructive
action.

### 5.5 Right to Restrict Processing

You may request that we limit the processing of your data under certain circumstances, such as when you contest its accuracy.

### 5.6 Right to Object

You may object to processing of your personal data for purposes not essential to providing the service.

To exercise any of these rights, contact us at **privacy@christex.foundation**.

---

## 6. Data Retention and Deletion

### 6.1 Active Data

Your data is retained for as long as your account is active and your organization maintains its subscription.

### 6.2 Soft Deletes and Trash

When you delete items such as tasks, wiki pages, or projects, they are **soft-deleted** (marked as archived or moved to trash). Soft-deleted items can be restored by authorized users within the retention window.

### 6.3 Permanent Deletion

- Items in the trash are permanently deleted after **30 days** unless restored.
- When you submit a valid deletion request, we will evaluate and process it in
  line with applicable law and our operational obligations. Content you authored
  within an organization may be retained in minimized or anonymized form where
  necessary to preserve organizational records.
- Organization-level deletion and retention handling is managed by maintainers
  and administrators according to deployment policy.
- Privacy requests are tracked through an internal request lifecycle
  (`PENDING`, `IN_REVIEW`, `COMPLETED`) to support accountability and auditability.

### 6.4 Backup Retention

Database backups that may contain deleted data are rotated and overwritten according to the backup schedule of the infrastructure provider, typically within **30 days**.

---

## 7. Cookies

ChristBase uses cookies strictly for functional purposes:

| Cookie | Purpose | Duration |
|---|---|---|
| **Session token** (`next-auth.session-token`) | Maintains your authenticated session | Until session expiry or logout |
| **CSRF token** (`next-auth.csrf-token`) | Prevents cross-site request forgery | Session |
| **Callback URL** (`next-auth.callback-url`) | Redirects you after authentication | Session |

We do **not** use advertising cookies, tracking pixels, or third-party analytics cookies. We do not participate in cross-site tracking.

---

## 8. Security

- Passwords are hashed using **bcrypt** before storage.
- Authentication is managed by **NextAuth.js** with support for Google OAuth and email/password credentials.
- All traffic between your browser and our servers is encrypted via **TLS/HTTPS**.
- Database connections use **TLS**.
- OAuth tokens (access tokens, refresh tokens, ID tokens) are stored encrypted in the database.

---

## 9. Children's Privacy

ChristBase is not directed at children under the age of 16. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, contact us at **privacy@christex.foundation** and we will delete it promptly.

---

## 10. Changes to This Policy

We may update this privacy policy from time to time. When we do, we will revise the "Last Updated" date at the top of this document. For material changes, we will notify users via in-app notification or email.

---

## 11. Contact

For privacy-related questions, data requests, or concerns:

**Email:** privacy@christex.foundation
**Organization:** Christex Foundation
