# Plan — Cycle 11

## Approach

After the existing revoke-and-reissue logic in POST /refresh, add an inline DELETE query that removes all refresh_tokens rows for that user where `revoked_at IS NOT NULL` OR `expires_at < current timestamp`. This keeps cleanup scoped to the active user and avoids the need for scheduled jobs or admin endpoints.

## Steps

1. Read the existing POST /refresh handler to understand the current revoke-and-reissue flow
2. Add a DELETE query after token rotation that removes all refresh_tokens for the user where `revoked_at IS NOT NULL` OR `expires_at < current timestamp`
3. Verify existing 37 tests still pass with zero regressions
4. Write a new test: create a user, generate multiple refresh tokens, revoke/expire some, call POST /refresh, then assert only the newly issued token remains for that user

## How to Test It

1. Run `pnpm test` from the monorepo root
2. **Verify:** All 37+ existing tests pass (covers success criterion 3: zero regressions)
3. **Verify:** A new test exists that does the following sequence:
   a. Register a user via POST /register
   b. Log in via POST /login to get an initial refresh token
   c. Call POST /refresh to rotate — this creates a revoked token + a new token
   d. Call POST /refresh again with the new token — now there should be stale (revoked) tokens to clean up
   e. Query the refresh_tokens table directly and assert: only the latest unexpired, non-revoked token remains for that user (covers success criteria 1, 2, and 4)
4. **Verify:** The new test passes as part of the `pnpm test` run

## Risks and Unknowns

- **Risk:** The DELETE might accidentally remove the newly issued token if the WHERE clause isn't precise — mitigation: ensure the new token's row is inserted before the DELETE runs, and the DELETE excludes non-revoked, unexpired tokens
- **Unknown:** Not sure if Drizzle ORM supports compound WHERE with OR conditions cleanly — may need to check the query builder syntax
- **Risk:** If the DELETE is slow on a user with many tokens, it could add latency to the refresh response — mitigation: user-scoped cleanup keeps the row count small

## First Move

Read the POST /refresh handler code to understand the current revoke-and-reissue flow before making any changes.
