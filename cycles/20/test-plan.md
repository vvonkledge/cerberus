# Test Plan — Cycle 20

> Step-by-step verification runbook for success criteria defined in define.md.

## Prerequisites

- Run `pnpm install` to ensure dependencies are up to date
- Tests use in-memory SQLite via the existing test harness

## Test Steps

1. **Action:** Run `pnpm --filter api test`
   **Verify:** All existing tests still pass (no regressions)

2. **Action:** Inspect the Drizzle schema file
   **Verify:** audit_logs table has columns: event_type (text), user_id (text), ip_address (text), timestamp (integer), metadata (text)

3. **Action:** POST /register with valid credentials
   **Verify:** Response is 201, then query the audit_logs table and verify an entry exists with event_type='register', the correct user_id, and a timestamp

4. **Action:** POST /login with valid credentials
   **Verify:** An audit entry with event_type='login' is created

5. **Action:** POST /login with invalid credentials
   **Verify:** An audit entry with event_type='login_failed' is created

6. **Action:** POST /refresh with valid token
   **Verify:** An audit entry with event_type='refresh' is created

7. **Action:** POST /revoke with valid token
   **Verify:** An audit entry with event_type='revoke' is created

8. **Action:** Hit an RBAC endpoint with valid auth and valid permission
   **Verify:** An audit entry with event_type='authz_granted' and the checked permission is created

9. **Action:** Hit an RBAC endpoint with valid auth but missing permission
   **Verify:** An audit entry with event_type='authz_denied' and the checked permission is created

10. **Action:** GET /audit-logs
    **Verify:** Returns paginated results with correct structure

11. **Action:** GET /audit-logs?event_type=login
    **Verify:** Only login events are returned

12. **Action:** Inspect all audit entries created during test run
    **Verify:** Every entry has event_type, user_id, ip_address, and timestamp fields populated

## Success Criteria Coverage

| Success Criterion | Verified by Step(s) |
|---|---|
| Audit log table exists with correct columns | Step 2 |
| All auth endpoints produce audit log entries | Steps 3, 4, 5, 6, 7 |
| All authorization checks produce audit log entries | Steps 8, 9 |
| GET /audit-logs returns paginated entries filtered by event type | Steps 10, 11 |
| Each audit entry includes event_type, user_id, ip_address, and timestamp | Step 12 |
