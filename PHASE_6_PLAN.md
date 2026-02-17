# Phase 6: Advanced Features & Scalability

The goal of Phase 6 is to extend ChristBase with advanced collaboration tools and data management features.

## Objectives
1.  **Wiki Templates**: Implement a system to create and use reusable page templates.
2.  **Notification System**: Real-time browser notifications for task assignments and mentions.
3.  **Data Portability**: Export project and task data to CSV/PDF.
4.  **User Profiles**: Enhanced user settings and profile management.

## Tasks

### 1. Wiki Templates
- [ ] Create `WikiTemplate` model in Prisma.
- [ ] UI to save a page as a template.
- [ ] UI to create a new page from a list of templates.

### 2. Enhanced Notifications
- [ ] Integration with `sonner` or `react-toastify` for real-time alerts.
- [ ] "Mark all as read" functionality.
- [ ] Notification preferences in settings.

### 3. Data Export
- [ ] CSV export for tasks (Project-level).
- [ ] PDF export for Wiki pages (using `react-to-print` or similar).

### 4. Advanced User Settings
- [ ] Avatar upload (S3/Cloudinary or local storage integration).
- [ ] Theme selection (Light/Dark/System).
- [ ] Workspace invite system.

## Success Criteria
- [ ] Users can create pages from templates in seconds.
- [ ] Real-time engagement via notifications.
- [ ] Data can be exported for external reporting.
- [ ] Users can personalize their experience.
