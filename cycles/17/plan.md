# Plan — Cycle 17

## Approach

Update AuthContext to hold both access and refresh tokens. Modify useApiFetch to catch 401 responses, call POST /refresh, update tokens in context, and retry the original request. On refresh failure, clear auth state and redirect to /login.

## Steps

1. Update POST /login response handling in AuthContext to extract and store both accessToken and refreshToken
2. Add refreshToken to AuthContext state and expose an updateTokens method
3. Modify useApiFetch to detect 401 responses
4. In the 401 handler, call POST /refresh with the stored refresh token
5. On refresh success, update both tokens in AuthContext and retry the original request
6. On refresh failure, call logout() to clear state and redirect to /login
7. Write dashboard tests verifying the refresh-on-401 flow

## How to Test It

1. Run `pnpm test` from the project root — all existing 92 tests pass (zero regressions)
2. Read AuthContext source — verify it stores both `accessToken` and `refreshToken` in state
3. Read AuthContext login handler — verify it extracts `refresh_token` from POST /login response and stores it
4. Read useApiFetch source — verify that on a 401 response, it calls POST /refresh with the stored refresh token
5. Read useApiFetch source — verify that on successful refresh, it updates both tokens in AuthContext and retries the original fetch
6. Read useApiFetch source — verify that on failed refresh (non-200), it calls logout() which clears state and redirects to /login
7. Run `pnpm test --filter dashboard` — verify new tests exist covering: (a) 401 triggers refresh, (b) successful refresh retries original request, (c) failed refresh redirects to /login

## Risks and Unknowns

- Risk: POST /login might not currently return the refresh token in its response body — need to verify the API response shape
- Unknown: Not sure how useApiFetch is currently structured — may need significant refactoring vs. a small change
- Risk: Retrying the original request after refresh could cause side effects if the original was a POST (non-idempotent)

## First Move

Add refreshToken to AuthContext state and update the login handler to store it.
