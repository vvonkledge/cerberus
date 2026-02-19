# Define — Cycle 22

## Problem Statement

The audit log API exists (GET /audit-logs) but can only be accessed via curl or API client. We need a dashboard page so admins can view and filter audit logs directly in the browser.

## Success Criteria

- [ ] Dashboard has an /audit-logs page listing entries in reverse chronological order
- [ ] Pagination controls let the user navigate through pages (default 20 per page)
- [ ] User can filter by event_type via a dropdown/select
- [ ] Audit logs page is protected — requires auth and manage_users permission
- [ ] Tests cover rendering, pagination, filtering, and auth protection

## Out of Scope

- No date range filtering — only event_type filter
- No full-text search across audit entries
- No CSV/JSON export
- No real-time/live updates
- No audit log detail/drill-down view
