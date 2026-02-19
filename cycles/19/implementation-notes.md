# Implementation Notes — Cycle 19

## Summary
Added delete and edit CRUD operations for roles and role assignments across both the API and dashboard. Three new API endpoints (DELETE /roles/:roleId, DELETE /users/:userId/roles/:roleId, PUT /roles/:roleId) and corresponding dashboard UI elements (delete button, edit form, remove button) were implemented. A critical integration bug was discovered and fixed during testing — the permissions endpoint needed to return assigned roles for the dashboard to function correctly.

## What Was Built

- **DELETE /roles/:roleId** (in `roles.ts`): Deletes a role from the database. Checks for user assignments first and returns 409 Conflict if the role is still assigned to any users (no cascade delete). Cleans up role_permissions entries before deleting the role. Returns 404 if role not found, 200 on success.

- **PUT /roles/:roleId** (in `roles.ts`): Updates a role's name. Validates name is present and non-empty (returns 400 otherwise). Returns 404 if role not found, 200 with updated role object on success.

- **DELETE /users/:userId/roles/:roleId** (in `user-roles.ts`): Removes a role assignment from a user. Checks user exists and assignment exists, returns 404 if either is missing. Returns 200 on success.

- **Enhanced GET /users/:userId/permissions** (in `user-roles.ts`): Extended to return assigned roles alongside permissions. Response changed from `{ permissions: [...] }` to `{ permissions: [...], roles: [{ id, name }] }`. This was a bug fix discovered during integration — the dashboard expected roles data but the API didn't provide it.

- **Dashboard role detail page** (in `role-detail.tsx`): Added "Rename Role" form with pre-filled input and Save button (calls PUT /roles/:roleId). Added "Delete Role" button (calls DELETE /roles/:roleId, redirects to /roles on success).

- **Dashboard user detail page** (in `user-detail.tsx`): Added "Remove" button next to each assigned role in the "Assigned Roles" section (calls DELETE /users/:userId/roles/:roleId, removes role from local state on success). Added `removing` state to track which role is being removed and show "Removing..." feedback.

- **API tests**: 17 new tests covering DELETE /roles/:roleId (success, 404, 409 conflict, role_permissions cleanup), PUT /roles/:roleId (success, 400 missing name, 400 empty name, 404), DELETE /users/:userId/roles/:roleId (success, 404 user not found, 404 not assigned), plus 401/403 auth tests for all new endpoints.

- **Dashboard tests**: 7 new tests — 4 for role-detail (delete button renders, edit form renders with pre-filled name, delete calls correct API, edit form submits with correct data) and 3 for user-detail (remove button renders next to each role, remove calls correct API, role removed from list after deletion).

## What Worked
- **Parallel vertical slices with clean file ownership**: 4 workers ran in parallel with zero file conflicts. Each worker owned exactly the files it needed: api-roles-worker (roles.ts, roles.test.ts), api-user-roles-worker (user-roles.ts, user-roles.test.ts), dashboard-role-detail-worker (role-detail.tsx, role-detail.test.tsx), dashboard-user-detail-worker (user-detail.tsx, user-detail.test.tsx). This was effective because the API and dashboard packages are naturally separated and even within the API, the roles and user-roles routers are independent files.
- **Following existing patterns**: Workers examined existing code patterns before implementing. The roles.ts DELETE and PUT handlers follow the exact same structure as the existing POST handlers (check role exists, validate input, perform operation, return JSON). The dashboard tests use the same manual JSX tree traversal approach as existing tests. This worked because the codebase has consistent conventions.
- **409 Conflict for assigned roles**: The decision to return 409 when deleting a role that's still assigned to users (rather than silently succeeding or cascade deleting) was the right call. It prevents accidental data loss and aligns with the "no cascade delete" out-of-scope constraint. The implementation is simple — check userRoles table before deleting.

## What Didn't Work
- **Dashboard user-detail assumed roles in API response**: The user-detail worker built the page reading `permsData.roles` from the GET /users/:userId/permissions response, but that endpoint only returned `{ permissions: string[] }`. The `assignedRoles` state would always be `[]`, meaning the remove buttons would never appear with real data. The dashboard component tests passed because they mocked the state directly, masking the integration gap. This was caught during orchestrator code review, not by automated tests. **Fix**: Enhanced GET /users/:userId/permissions to also query and return assigned roles. The response now includes both `permissions` and `roles` arrays.
- **Dashboard tests mock state rather than API responses**: The dashboard test approach (manually constructing JSX trees with mocked useState) validates component structure but doesn't catch API contract mismatches. A real integration test starting the dev server would have caught the roles bug immediately.

## Files Changed

### Created
- `packages/dashboard/src/__tests__/role-detail.test.tsx` — Component tests for role detail delete button and edit form (4 tests)
- `packages/dashboard/src/__tests__/user-detail.test.tsx` — Component tests for user detail role removal (3 tests)

### Modified
- `packages/api/src/rbac/roles.ts` — Added PUT /:roleId (rename) and DELETE /:roleId (delete with 409 conflict check and role_permissions cleanup)
- `packages/api/src/rbac/user-roles.ts` — Added DELETE /:userId/roles/:roleId (unassign role). Enhanced GET /:userId/permissions to also return assigned roles array.
- `packages/api/src/__tests__/roles.test.ts` — Added test suites for PUT /roles/:roleId (4 tests), DELETE /roles/:roleId (4 tests), plus 401/403 auth tests for both new endpoints (4 tests). Added helper functions rolesPutRequest and rolesDeleteRequest.
- `packages/api/src/__tests__/user-roles.test.ts` — Added test suite for DELETE /users/:userId/roles/:roleId (3 tests), plus 401/403 auth tests (2 tests). Added deleteUserRole helper function.
- `packages/dashboard/src/pages/role-detail.tsx` — Added handleDelete function, handleEditName function, editName/saving/deleting state, "Rename Role" form section, and "Delete Role" button with navigation to /roles on success.
- `packages/dashboard/src/pages/user-detail.tsx` — Added handleRemoveRole function, assignedRoles state, removing state, "Assigned Roles" section with remove buttons next to each role.

## Decisions Made
- **409 Conflict over silent delete for assigned roles**: Chose to return 409 when attempting to delete a role still assigned to users, rather than silently succeeding (which would orphan the user_roles records) or cascade-deleting (which was explicitly out of scope). This is consistent with the out-of-scope constraint and makes the behavior explicit for API consumers.
- **Inline edit form instead of modal or toggle**: The rename form is always visible on the role detail page rather than hidden behind a toggle or shown in a modal. This is simpler and follows the existing dashboard pattern where forms are always visible (e.g., the "Assign Permission" form, the "Assign Role" form).
- **Clean up role_permissions before role deletion**: When deleting a role, the handler first deletes all role_permissions entries for that role, then deletes the role itself. Without this, orphaned role_permissions rows would accumulate. This cleanup is safe because we already verified no users reference the role.
- **Return roles in permissions endpoint**: Rather than adding a separate GET /users/:userId/roles endpoint, chose to extend the existing GET /users/:userId/permissions to also return roles. This keeps the API surface smaller and the dashboard already calls this endpoint.

## Plan Deviations
- **Enhanced GET /users/:userId/permissions**: The plan did not include modifying this endpoint, but a bug discovered during integration required adding a `roles` array to its response. Without this, the dashboard user-detail page could not display assigned roles or remove buttons. This was a necessary deviation to make the dashboard-API contract work.

## Test Results
- `pnpm --filter api test`: **PASS** — 102 tests across 12 files (was 85, +17 new)
- `pnpm --filter dashboard test`: **PASS** — 29 tests across 5 files (was 22, +7 new)
- **Total: 131 tests pass** (was 107, +24 new), zero regressions
- Fix→retest cycle: 1 iteration (permissions endpoint enhancement, then all tests passed)

## Challenges and Learnings

### Challenges
- **API-dashboard contract mismatch**: The dashboard worker assumed the API returned roles in the permissions response, but the API worker built the endpoint without that. Parallel workers building against an implicit contract (no shared API spec) led to a mismatch that component-level mocking couldn't catch. Resolution: orchestrator caught it during code review and spawned a fix worker.

### Learnings
- **Component-level mocking masks integration bugs**: Dashboard tests that mock React state directly validate component structure (button exists, click handler fires) but don't validate the data flow from API to component. Integration tests or contract tests would catch these earlier.
- **Parallel workers need explicit API contracts**: When frontend and backend workers run in parallel, the API response shapes should be explicitly agreed upon upfront. In this case, the dashboard worker assumed `roles` in the permissions response, while the API worker only knew about the existing response format.
- **File ownership prevents conflicts but not contract mismatches**: The 4-worker parallel approach worked perfectly for file ownership (zero conflicts), but the semantic contract between API responses and dashboard expectations was not covered by file ownership alone.

## Product Insights
- **Role management needs a roles-per-user view**: The GET /users/:userId/permissions endpoint now serves dual duty — returning both permissions and roles. As the system grows, a dedicated GET /users/:userId/roles endpoint might be cleaner, especially if roles need metadata beyond id and name.
- **No cascade delete creates a UX challenge**: The 409 Conflict response when deleting an assigned role means the admin must manually unassign the role from all users before deleting it. The dashboard doesn't yet guide the admin through this workflow — they'd need to visit each user's detail page. A future cycle might add a "force delete" with unassignment, or at least show which users have the role.

## Notes for REFLECT
- The project now has full CRUD for roles and role assignments at both API and dashboard layers. The original Goal's "role and permission management" in the admin dashboard is substantially complete — create, read, update, delete for roles; create, read, delete for role assignments. Edit/delete for permissions themselves remains out of scope.
- The honest current state: 131 tests pass, all 8 success criteria are met, and the one integration bug found was fixed. The dashboard tests use a shallow component testing approach that doesn't catch API contract mismatches — this is a known limitation but not a blocking issue.
- Recommended next cycle direction: consider admin bootstrap flow in the dashboard (POST /seed via UI), concurrent 401 deduplication, or permission CRUD — depending on which gap matters most.
- No new technical debt introduced beyond the existing testing approach limitation.
