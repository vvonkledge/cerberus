# Reflect — Cycle 25

## What Worked

- **Optimistic pattern for bootstrap check**: The plan identified GET /roles as a way to check if admin exists, but Risk #1 correctly predicted that fresh users lack manage_roles permission and would get 403. Skipping the preflight check entirely and using POST /seed's 409 response as the "already configured" signal was simpler and avoided the permission chicken-and-egg problem.
- **Direct fetch for unauthenticated endpoint**: POST /seed requires no auth, so using raw `fetch` instead of `useApiFetch` was correct. useApiFetch adds Bearer token headers and 401 retry logic that would have been unnecessary overhead.
- **JWT decode for userId extraction**: A simple `atob(token.split('.')[1])` to extract `sub` from the JWT payload avoided needing a JWT library or changes to AuthContext. The getUserIdFromToken helper is a pure function, easy to reason about and test.
- **Consistent test patterns**: Replicating the mock-React-hooks + setupState + findAll/getTextContent pattern from existing dashboard tests (api-keys.test.tsx) kept the test suite consistent and required no new testing infrastructure.

## What Didn't Work

- **Plan steps 2-3 (GET /roles check on mount) were not viable**: The planned check-then-render approach via GET /roles was a circular dependency — you cannot query permissions before the permission system is bootstrapped. This deviation was anticipated by the plan's own risk section. The optimistic approach replaced it cleanly.
- **useApiFetch was unnecessary**: The plan assumed useApiFetch for API calls, but since POST /seed requires no authentication, the auth-aware hook added complexity without value. Direct fetch was used instead.

## What Changed in Understanding

Bootstrap UIs that set up the permission system cannot use the permission system to check their own preconditions. This is a general pattern: any setup flow that creates the very thing it needs to check for must use an optimistic approach — attempt the action and handle the "already done" response. The GET /roles permission risk in the plan was a real circular dependency, not just a theoretical concern. Future bootstrap-type features should default to optimistic patterns. Additionally, unauthenticated API endpoints should use direct fetch rather than the auth-aware useApiFetch hook, since the hook's token injection and 401 retry logic are meaningless for endpoints that require no auth.

## Product Changes

No product definition changes this cycle. The implementation notes observed that the setup page is visible to all authenticated users (no way to hide it post-bootstrap) and that POST /seed is unauthenticated (security window between deployment and first bootstrap). Both are acceptable for the solo-developer target user and do not require product scope changes.
