# Implementation Notes — Cycle 17

## Summary
Added automatic token refresh to the dashboard. AuthContext now stores both access and refresh tokens, and useApiFetch intercepts 401 responses to transparently refresh the access token and retry the request. Five new dashboard tests verify the refresh-on-401 flow. All 97 tests pass (85 API + 12 dashboard).

## What Was Built
- **AuthContext refresh token storage**: Added `refreshToken` state alongside existing `token` state. Login handler now extracts and stores both `access_token` and `refresh_token` from the POST /login response. Added `updateTokens(accessToken, refreshToken)` method exposed on the context value. Logout clears both tokens.
- **useApiFetch 401 interception**: After any fetch, checks for 401 status. If a refresh token exists, calls POST /refresh with `{ refresh_token }`. On success (200), calls `updateTokens` with new tokens and retries the original request with the new access token. On failure (non-200) or if no refresh token exists, calls `logout()` — the existing ProtectedRoute handles redirect to /login.
- **Token refresh tests**: Five Vitest tests covering: normal auth header injection, 401 triggering refresh, successful refresh retrying with new token, failed refresh calling logout, and 401 without refresh token calling logout immediately.

## What Worked
- **Minimal-touch approach**: The existing code was well-structured with clear separation (AuthContext for state, useApiFetch for fetch logic). Adding refresh support required only extending existing patterns — adding a state variable, extending the context interface, and adding a conditional block in the fetch callback. This worked because the original design anticipated extension.
- **Mocking useAuth for tests**: The test-writer used `vi.mock("../auth-context")` with `vi.hoisted()` mocks and `vi.mock("react")` to bypass React's useCallback hook. This let the tests call `useApiFetch()` directly as a plain function without needing a React rendering environment, avoiding the need for @testing-library/react or jsdom.
- **POST /login already returned refresh_token**: The API was already returning the refresh token in the login response (it was just being discarded by the dashboard). This meant zero API changes were needed — a risk identified in the plan that turned out not to be an issue.

## What Didn't Work
- No significant blockers encountered. Implementation proceeded as planned. The test writer had to iterate on the mocking strategy (mocking `useCallback` to pass through the function directly) which required understanding Vitest's module mock hoisting semantics, but this was resolved within the first attempt.

## Files Changed

### Created
- `packages/dashboard/src/__tests__/token-refresh.test.tsx` — 5 tests verifying useApiFetch token refresh behavior (401 triggers refresh, successful refresh retries, failed refresh calls logout, no refresh token calls logout)

### Modified
- `packages/dashboard/src/auth-context.tsx` — Added `refreshToken` state, `updateTokens` method, updated login to store refresh_token, updated logout to clear both tokens, extended AuthContextValue interface
- `packages/dashboard/src/api-client.ts` — Added 401 detection, POST /refresh call with refresh token, token update + retry on success, logout on failure

## Decisions Made
- **Single retry (no retry loop)**: On 401, we attempt one refresh and one retry. If the retry also returns 401, we don't try again — we return the response as-is. This is correct because if the freshly-obtained token is already invalid, something else is wrong. Alternative was a retry loop with max attempts, but that adds complexity for a scenario that shouldn't happen.
- **Return original 401 response on logout**: When refresh fails or no refresh token exists, we call `logout()` and return the original 401 response to the caller. This lets callers handle the response if needed, while the ProtectedRoute redirect handles navigation. Alternative was throwing an error, but returning the response is more consistent with the hook's contract.
- **Mock useCallback as passthrough for tests**: Instead of rendering React components with @testing-library/react (not installed), we mocked `useCallback` to return the raw function. This lets us test useApiFetch as a plain function. Alternative was installing testing-library, but that would have added a dependency outside the cycle's scope.
- **No concurrent 401 deduplication**: As specified in out-of-scope, we don't deduplicate concurrent refresh attempts. If two API calls both get 401, each will independently try to refresh. This is acceptable for now but could waste refresh tokens.

## Plan Deviations
- Implementation followed the plan as written. All 7 plan steps were executed in order.

## Test Results
- Step 1 (Run `pnpm test`): PASS — 97 tests pass (85 API + 12 dashboard), zero regressions. 5 new tests added (was 92, now 97).
- Step 2 (AuthContext stores both tokens): PASS — `auth-context.tsx` has `useState<string | null>(null)` for both `token` and `refreshToken`.
- Step 3 (Login extracts refresh_token): PASS — Login handler calls `setRefreshToken(data.refresh_token)` after successful POST /login.
- Step 4 (401 triggers refresh): PASS — `api-client.ts` checks `response.status === 401`, then calls `fetch("/refresh", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) })`.
- Step 5 (Successful refresh retries): PASS — On `refreshRes.ok`, calls `updateTokens(data.access_token, data.refresh_token)` and retries with `Bearer ${data.access_token}`.
- Step 6 (Failed refresh triggers logout): PASS — On `!refreshRes.ok`, calls `logout()`. Also calls `logout()` when no refreshToken exists.
- Step 7 (Dashboard tests cover refresh flow): PASS — 5 tests in `token-refresh.test.tsx` cover all 3 required scenarios plus baseline auth header and no-refresh-token edge case.

## Challenges and Learnings

### Challenges
- **Testing React hooks without testing-library**: The dashboard uses Vitest but doesn't have @testing-library/react installed. The test writer solved this by mocking `useCallback` to be a passthrough and mocking `useAuth` to return controlled values, allowing direct invocation of useApiFetch as a function.

### Learnings
- The existing codebase was already well-structured for this change — AuthContext and useApiFetch had clean separation. The API already returned refresh tokens in login responses. This confirms the prior cycles' architectural decisions were sound.
- React hooks can be tested without a rendering library by mocking the hook dependencies (useCallback, useContext) at the module level. This pattern is useful for testing logic-heavy hooks.

## Product Insights
- Token refresh is invisible to the user — the dashboard now silently refreshes expired tokens. However, with the 1-hour access token and 7-day refresh token, a user who leaves a tab open for more than 7 days will be silently logged out on their next action. A future cycle might consider a "session expired" notification to give the user context when this happens (currently out of scope).

## Notes for REFLECT
- No assumptions about the project proved wrong. The API response shape matched expectations.
- The dashboard auth system is now feature-complete for basic usage: login, protected routes, token refresh on expiry. Key remaining gaps: no token persistence across browser sessions (refresh resets on page reload), no concurrent 401 deduplication, no admin bootstrap UI, no delete/edit for roles/assignments.
- Test count increased from 92 to 97 (5 new dashboard tests).
- The honest current state: the dashboard handles token expiration gracefully during a session, but still loses auth state on page reload since tokens are in React state only.
