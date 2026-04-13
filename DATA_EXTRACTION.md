# ChristBase Data Extraction

**DPG Standard Criterion 6: Mechanism for Extracting Non-PII Data**
**Effective Date:** April 13, 2026
**Last Updated:** April 13, 2026

This document describes how ChristBase enables organizations to extract
non-personally identifiable project content and operational data in
non-proprietary formats.

## Scope

ChristBase stores both personal data and organizational work data. For the
purposes of Digital Public Goods evaluation, this document focuses on
extractable, non-PII content such as tasks, project records, wiki content, and
custom database data.

## Supported Export Mechanisms

### 1. Task export to CSV

Task lists can be exported in CSV format from task table and board views.

- **Format:** CSV
- **Implementation:** `src/lib/export.ts`
- **UI integrations:**
  - `src/components/tasks/task-table.tsx`
  - `src/app/(dashboard)/projects/[projectId]/board/page.tsx`

The CSV output uses standard comma-separated values and can be opened by common
spreadsheet tools and imported into other systems.

### 2. Custom database export to CSV

Custom database rows can be exported in CSV format from the database table
interface.

- **Format:** CSV
- **Implementation:** `src/lib/export.ts`
- **UI integration:** `src/components/databases/database-table-view.tsx`

This export preserves the visible schema columns and serializes values into a
portable text representation.

### 3. Wiki export to PDF

Wiki pages can be exported as PDF documents from the wiki page view.

- **Format:** PDF
- **Implementation:** `src/components/wiki/wiki-page-view.tsx`

This supports extracting organizational knowledge-base content for archival,
sharing, and migration workflows.

### 4. Personal data export to JSON

Authenticated users can download a JSON export of their account-scoped data from
the Settings screen.

- **Format:** JSON
- **Implementation:** `src/actions/privacy.ts`
- **UI integration:** `src/components/settings/privacy-controls.tsx`

The export includes profile metadata, memberships, notification preferences,
favorites, recent items, reflections, assigned tasks, user-authored comments and
wiki records, messages sent by the user, attachments uploaded by the user, and
submitted privacy requests.

This export is available as a self-service download from Settings and is also
complemented by a tracked manual review request path for cases where additional
support or validation is required.

### 5. JSON-based API/report outputs

ChristBase includes server-side report endpoints that exchange data in JSON,
which supports machine-readable interoperability.

- **Format:** JSON over HTTP
- **Implementation:** `src/app/api/reports/`

## Non-Proprietary Formats

ChristBase uses broadly supported, non-proprietary export formats:

- **CSV** for tabular task and database data
- **PDF** for document-style wiki exports
- **JSON** for API/report integrations

These formats are vendor-neutral and can be consumed without proprietary
software.

## Data Portability Position

ChristBase is designed so organizations can extract their work product without
being locked into a proprietary storage format. The current extraction surface
includes:

- Task records
- Custom database rows
- Wiki content
- User-scoped account and activity data
- Report data exposed in JSON

Personal account data and privacy-rights requests are handled separately under
[PRIVACY.md](./PRIVACY.md).

## Current Limitations

The export surface is currently strongest for:

- Task data
- Custom database data
- Wiki content

Future improvements may extend standardized export coverage for additional
modules such as chat history, milestones, and analytics snapshots.

Workspace administrators can also review submitted privacy requests through the
Settings interface, which supports an operational workflow around export and
deletion handling even where fully automated fulfillment is not appropriate.

## References

- `src/lib/export.ts`
- `src/components/tasks/task-table.tsx`
- `src/app/(dashboard)/projects/[projectId]/board/page.tsx`
- `src/components/databases/database-table-view.tsx`
- `src/components/wiki/wiki-page-view.tsx`
- `src/app/api/reports/`
