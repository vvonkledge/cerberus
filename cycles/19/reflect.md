# Reflect — Cycle 19

## What Worked

- **Parallel vertical slices with strict file ownership**: Four workers ran simultaneously with zero file conflicts. Each owned exactly the files it needed (api-roles-worker: roles.ts + roles.test.ts; api-user-roles-worker: user-roles.ts + user-roles.test.ts; dashboard-role-detail-worker: role-detail.tsx + role-detail.test.tsx; dashboard-user-detail-worker: user-detail.tsx + user-detail.test.tsx). The natural separation between API and dashboard packages, and between the roles and user-roles routers, made this decomposition clean.
- **Following existing code patterns**: Workers examined existing endpoint handlers and test structures before implementing. The new DELETE and PUT handlers in roles.ts follow the exact same structure as the existing POST handlers (check existence, validate input, perform operation, return JSON). Dashboard tests reuse the same manual JSX tree traversal approach. Consistent codebase conventions made onboarding new code straightforward.
- **409 Conflict for assigned role deletion**: Returning 409 when deleting a role still assigned to users prevents accidental data loss and honors the out-of-scope constraint against cascade deletion. The check is a single query against the userRoles table before proceeding with delete.
- **Cleaning up role_permissions on role delete**: Deleting associated role_permissions entries before the role itself prevents orphaned join-table rows, and is safe because the 409 check already guarantees no users reference the role.

## What Didn't Work

- **API-dashboard contract mismatch on permissions endpoint**: The dashboard user-detail worker built the page reading `permsData.roles` from GET /users/:userId/permissions, but the API worker implemented that endpoint returning only `{ permissions: string[] }` — no roles array. The assigned roles list would always be empty. Component-level tests passed because they mocked React state directly, masking the gap entirely. The orchestrator caught the mismatch during code review, not automated tests. A fix worker enhanced the endpoint to return `{ permissions: [...], roles: [{ id, name }] }`.
- **Shallow component mocking hides integration issues**: The dashboard test approach (mocking useState to inject state, then checking JSX structure) validates that buttons exist and handlers fire, but cannot detect that the API response shape doesn't match what the component expects. A contract test or integration test would have caught this before the code review stage.
- **Unplanned plan deviation**: The plan did not include modifying GET /users/:userId/permissions. The integration bug forced an unplanned enhancement to that endpoint — adding a roles query and including the roles array in the response. This was necessary to make the dashboard functional but was not anticipated during planning.

## What Changed in Understanding

Parallel worker decomposition based on file ownership prevents write conflicts but does not prevent semantic contract mismatches between frontend and backend. When API and dashboard workers run simultaneously against an implicit contract (no shared type definition or API spec), mismatches in response shapes go undetected until integration. The dashboard testing approach (mocking state directly) compounds this by validating component structure without exercising the actual data flow. Future cycles with parallel frontend/backend work should either define response shapes explicitly before spawning workers, or include a contract validation step. This cycle also confirmed that the codebase's consistent coding conventions (handler structure, test patterns, Tailwind styling) make parallel development effective — workers produce code that fits naturally alongside existing code.

## Product Changes

No product definition changes this cycle. Two forward-looking observations from implementation: (1) GET /users/:userId/permissions now serves dual duty returning both permissions and roles — a dedicated GET /users/:userId/roles endpoint may be cleaner as the system grows; (2) the 409 Conflict on deleting assigned roles creates a multi-step admin workflow (unassign from all users, then delete) that the dashboard does not yet guide users through.
