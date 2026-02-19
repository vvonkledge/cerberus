# Plan — Cycle 22

## Approach

Build an AuditLogsPage component following the same patterns as the existing roles/users pages — use useApiFetch to call GET /audit-logs, add route to the router, add nav link, implement pagination and event_type filter as React state driving query params.

## Steps

1. Create AuditLogsPage component that fetches GET /audit-logs via useApiFetch and renders entries in a table (timestamp, event_type, user_id, ip_address, metadata)
2. Add pagination state (page number) and wire Previous/Next controls to re-fetch with page query param
3. Add /audit-logs route to the React Router config, wrapped in ProtectedRoute
4. Add event_type filter as a select/dropdown that re-fetches with event_type query param
5. Add "Audit Logs" link to the navigation layout
6. Write tests for: rendering audit log entries, pagination controls, event_type filtering, and auth protection (redirect when unauthenticated)

## How to Test It

1. Run `pnpm test` from the project root — all existing 162 tests pass (no regressions)
2. Verify new dashboard tests exist covering:
   a. AuditLogsPage renders a table of audit log entries (mocked API response)
   b. Pagination: clicking Next/Previous updates the page and re-fetches
   c. Filtering: selecting an event_type from the dropdown re-fetches with the filter
   d. Auth protection: unauthenticated users are redirected to /login
3. Run `pnpm test` again — all tests pass including the new ones
4. Start the dev server, log in as an admin user, navigate to /audit-logs:
   a. Verify the page shows audit log entries in reverse chronological order
   b. Verify pagination controls appear and navigate between pages
   c. Verify the event_type dropdown filters entries
   d. Verify a non-admin user (without manage_users permission) cannot access the page

## Risks and Unknowns

- Risk: The existing GET /audit-logs response shape might not include all fields needed for the table — mitigation: check the API response before building the component
- Unknown: Not sure what event_type values exist in the system — may need to hardcode a known list or derive from the API response

## First Move

Read an existing dashboard page component (e.g., RolesPage or UsersPage) and the GET /audit-logs handler to understand the response shape and existing patterns before writing any code.
