# Define — Cycle 20

## Problem Statement

Auth and authz events happen silently with no record. Add audit logging so all authentication and authorization events are captured for review.

## Success Criteria

- [ ] Audit log table exists with columns for event_type, user_id, ip_address, timestamp, and metadata
- [ ] All auth endpoints (register, login, refresh, revoke) produce audit log entries
- [ ] All authorization checks (both granted and denied) produce audit log entries with the checked permission
- [ ] GET /audit-logs returns paginated entries filtered by event type
- [ ] Each audit entry includes event_type, user_id, ip_address, and timestamp

## Out of Scope

- Not logging RBAC management events (role create/delete, permission assign/unassign, user-role assign/remove) — only auth and authz check events
- Not adding audit log retention/cleanup policies
- Not adding dashboard UI for viewing audit logs
- Not adding real-time streaming or webhooks for audit events
