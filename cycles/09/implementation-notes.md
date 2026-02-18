# Implementation Notes — Cycle 09

## Summary
Built the React admin dashboard with pages for managing roles, permissions, and user-role assignments. Added two GET endpoints (GET /roles, GET /users) to support the dashboard, then created a React Router SPA with four pages: roles list, role detail, users list, and user detail.

## What Was Built
- GET /roles endpoint returning all roles with their permissions
- GET /users endpoint returning all users (id and email only)
- React Router setup with navigation layout
- Roles page: lists roles in a table, form to create a new role
- Role detail page: shows role name/description, lists permissions, form to assign a permission string
- Users page: lists users in a table
- User detail page: shows resolved permissions, dropdown to assign a role to the user

## Files Changed

### Created
- `packages/api/src/__tests__/list-endpoints.test.ts` — 5 tests covering GET /roles (empty, with permissions, no permissions) and GET /users (empty, multiple users)
- `packages/dashboard/src/pages/roles.tsx` — Roles list page with create role form
- `packages/dashboard/src/pages/role-detail.tsx` — Role detail page with assign permission form
- `packages/dashboard/src/pages/users.tsx` — Users list page
- `packages/dashboard/src/pages/user-detail.tsx` — User detail page with resolved permissions and assign role form

### Modified
- `packages/api/src/rbac/roles.ts` — Added GET / handler returning roles with permissions via join query
- `packages/api/src/rbac/user-roles.ts` — Added GET / handler returning users with id and email only
- `packages/dashboard/package.json` — Added react-router-dom dependency
- `packages/dashboard/src/main.tsx` — Wrapped App in BrowserRouter
- `packages/dashboard/src/app.tsx` — Replaced placeholder with React Router Routes and Layout component
- `pnpm-lock.yaml` — Updated for react-router-dom

## Decisions Made
- Used Hono sub-app pattern for new GET endpoints, co-locating them with existing POST endpoints in `roles.ts` and `user-roles.ts` rather than adding them to `index.ts`
- Used BrowserRouter with a catch-all route in Hono (`app.get("*", ...)` serving ASSETS) to handle client-side routing
- Role detail page fetches all roles via GET /roles and finds the target role client-side (no GET /roles/:id endpoint) — simple approach that avoids adding another endpoint
- User detail page fetches users, permissions, and roles in parallel via Promise.all for faster loading
- Used a dropdown select for role assignment on user detail page rather than free-text input, fetching available roles from GET /roles

## Plan Deviations
- The plan listed the permission assignment endpoint as `POST /roles/:roleId/permissions` with body `{"permissions": ["perm1", "perm2"]}` (array). The actual existing endpoint accepts `{"permission": "perm1"}` (single string). The dashboard's role detail page sends a single permission string matching the existing API contract.

## Test Results
- GET /roles (empty array): PASS
- GET /roles (roles with permissions): PASS
- GET /roles (role with no permissions): PASS
- GET /users (empty array): PASS
- GET /users (multiple users, no password leak): PASS
- POST /roles (create role): PASS
- POST /roles/:id/permissions (assign permission): PASS
- GET /users (list users): PASS
- POST /users/:id/roles (assign role): PASS
- GET /users/:id/permissions (resolved permissions): PASS
- Dashboard build: PASS
- All existing API tests: PASS (35 tests total)

## Challenges and Learnings
- The existing RBAC endpoints used a single permission string (`{"permission": "..."}`) rather than an array, which differed from the plan's assumed API shape — the dashboard was adapted to match the real API
- React Router client-side routing inside Hono worked cleanly because the Hono catch-all `app.get("*", ...)` serves the dashboard's index.html for any unmatched route, enabling the SPA to handle its own routing

## Notes for REFLECT
- All 5 success criteria are met: roles page lists roles, roles can be created, permissions can be assigned to roles, roles can be assigned to users, and resolved permissions are visible
- The dashboard has no authentication — it's accessible to anyone who can reach the Worker (as noted in out-of-scope)
- No delete/edit operations exist yet for roles, permissions, or assignments (also out-of-scope)
- The role detail page's approach of fetching all roles to find one is fine at small scale but may need a dedicated GET /roles/:id endpoint later
