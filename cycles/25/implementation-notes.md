# Implementation Notes — Cycle 25

## Summary

Added an admin bootstrap page at /setup in the dashboard. Authenticated users can click "Bootstrap Admin" to call POST /seed, which creates the admin role and assigns it to their account. If the admin role already exists, the page shows an "already configured" message. 10 new dashboard tests pass; 210 total tests with zero regressions.

## What Was Built

- **SetupPage component** (`packages/dashboard/src/pages/setup.tsx`): A React page that shows a heading ("System Setup"), explanation text, and a "Bootstrap Admin" button. The button decodes the JWT token to extract the user's ID, calls POST /seed with `{ userId }`, and navigates to `/` on success. On 409 (admin already exists), it switches to a "system is already configured" message with no button. Errors (network failures, missing token) are displayed inline.
- **Route and navigation** (`packages/dashboard/src/app.tsx`): Added `/setup` route inside ProtectedRoute + Layout, and a "Setup" link in the navigation bar.
- **Test suite** (`packages/dashboard/src/__tests__/setup.test.tsx`): 10 tests covering all rendering states (heading, button, seeding/disabled, error, configured) and all action paths (POST /seed with correct userId, navigation on success, 409 handling, network error, missing token).

## What Worked

- **Optimistic approach to admin-exists check**: The plan identified a risk that GET /roles requires manage_roles permission (a fresh user without admin can't call it). Instead of fighting the permission system, the worker used an optimistic pattern — always show the bootstrap button and let POST /seed's 409 response serve as the "already configured" signal. This eliminated the need for a preflight check entirely and was simpler than any alternative.
- **Direct fetch instead of useApiFetch**: Since POST /seed requires no authentication, using the raw `fetch` API instead of the `useApiFetch` hook was correct. useApiFetch adds Bearer token headers and 401 retry logic — unnecessary overhead for an unauthenticated endpoint.
- **JWT decode for userId**: A simple `atob(token.split('.')[1])` to extract `sub` from the JWT payload worked cleanly. No need for a JWT library or new AuthContext method. The getUserIdFromToken helper is a pure function at module scope, easy to test.
- **Following existing test patterns exactly**: The test file replicates the mock-React-hooks + setupState + findAll/getTextContent pattern from api-keys.test.tsx, making it consistent with the rest of the dashboard test suite.

## What Didn't Work

- No significant blockers encountered. Implementation proceeded as planned.

## Files Changed

### Created
- `packages/dashboard/src/pages/setup.tsx` — SetupPage component with admin bootstrap UI
- `packages/dashboard/src/__tests__/setup.test.tsx` — 10 tests covering all SetupPage states and actions

### Modified
- `packages/dashboard/src/app.tsx` — Added SetupPage import, /setup route, and Setup nav link

## Decisions Made

- **Optimistic vs. preflight check**: Chose to always show the bootstrap button rather than checking admin-exists on mount. Alternatives considered: (1) call GET /roles and check for admin role — rejected because fresh users get 403 from manage_roles permission requirement, (2) add a new unauthenticated endpoint to check admin status — rejected as out of scope (no API changes). The optimistic approach with 409 handling is the simplest solution that satisfies all success criteria.
- **Direct fetch vs useApiFetch**: Used `fetch` directly for POST /seed since it requires no auth. Using useApiFetch would have added unnecessary Bearer token headers to an unauthenticated endpoint.
- **No loading state on mount**: Since there's no preflight API call (no admin-exists check on mount), there's no initial loading state. The page renders immediately with the bootstrap button. This is a UX improvement — no spinner on page load.
- **Nav placement**: Added "Setup" link after "API Keys" in the navigation bar, before the logout button. This makes it always accessible but not prominently featured.

## Plan Deviations

- **Steps 2-3 from plan (GET /roles check on mount) were skipped**: The plan called for calling GET /roles on mount to check if admin role exists. This was identified as Risk #1 — fresh users can't call GET /roles due to manage_roles permission. Instead of implementing the check-then-render pattern, the worker went with the optimistic approach: always render the bootstrap form, handle 409 from POST /seed as "already configured." This deviation was anticipated by the plan's own risk section.
- **No useApiFetch usage**: The plan said "calls GET /roles on mount via useApiFetch." Since the approach changed to skip the GET /roles check, and POST /seed requires no auth, useApiFetch was not needed at all. Direct fetch was used instead.

## Test Results

1. **All existing 200 tests pass**: PASS — 150 API + 50 dashboard = 200, zero regressions
2. **New SetupPage tests pass**: PASS — 10 new tests in setup.test.tsx
3. **Loading state test**: PASS — "shows Bootstrapping... text when seeding" covers the in-progress state
4. **Bootstrap UI when no admin**: PASS — "renders heading and explanation text" + "renders Bootstrap Admin button"
5. **Already configured state**: PASS — "shows already configured message when configured" verifies message shown and no button present
6. **POST /seed with userId**: PASS — "calls POST /seed with correct userId on click" verifies fetch called with `{ userId: 42 }`
7. **Redirect after success**: PASS — "navigates to / after successful seed" verifies navigate("/") called
8. **409 handling**: PASS — "handles 409 conflict (admin already exists)" verifies navigate not called
9. **Network error**: PASS — "handles network error" verifies navigate not called on fetch rejection
- **Total**: 210 tests passing (150 API + 60 dashboard)

## Challenges and Learnings

### Challenges
- **Permission chicken-and-egg problem**: The plan called for GET /roles to check admin existence, but GET /roles requires manage_roles — which only exists after POST /seed creates the admin role. This is a fundamental bootstrap problem: you can't check permissions before the permission system is bootstrapped. The optimistic approach (try seed, handle 409) elegantly sidesteps this.

### Learnings
- **Bootstrap UIs should avoid pre-checks that depend on the thing being bootstrapped**: The admin-exists check via GET /roles was a circular dependency. Future bootstrap-type features should default to optimistic patterns — attempt the action and handle the "already done" response.
- **Unauthenticated endpoints don't need useApiFetch**: When an API endpoint requires no auth, using the auth-aware fetch hook adds unnecessary complexity and potentially misleading behavior. Direct fetch is simpler and more correct.

## Product Insights

- The setup page is accessible to any authenticated user via /setup in the nav. Currently there's no way to hide it after bootstrapping or restrict who can see it. This is fine for a solo developer (the target user), but would need access control if Cerberus served teams. Not a concern for current scope.
- The POST /seed endpoint is unauthenticated by design, which means anyone who can reach the API can attempt to bootstrap admin. The 409 idempotency guard prevents re-bootstrapping, but the window between deployment and first bootstrap is a security consideration for production use.

## Notes for REFLECT

- The GET /roles permission risk identified in the plan was real and drove the main architectural deviation. The optimistic pattern was a better fit than any check-based approach.
- The project now has 7 protected dashboard pages (roles, role detail, users, user detail, audit logs, API keys, setup). The admin bootstrap flow is the only page that calls an unauthenticated API endpoint.
- After this cycle, the "No admin bootstrap flow in the dashboard" gap from state.md Position is resolved. POST /seed can now be called from the browser via /setup.
- 210 total tests (150 API + 60 dashboard) with zero regressions.
- The setup page currently appears in nav for all users. A future cycle could conditionally show it only when admin isn't configured, but that would require solving the same permission-check problem (or adding a public status endpoint).
