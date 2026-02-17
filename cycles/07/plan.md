# Plan — Cycle 07

## Approach

Store refresh tokens in Turso as opaque random strings. Add a POST /refresh endpoint that validates the token and issues a new JWT access token. Add a POST /revoke endpoint to invalidate tokens. Return the refresh token alongside the access token from POST /login.

## Steps

1. Add a refresh_tokens table to the Drizzle schema (token, user_id, expires_at, revoked_at, created_at)
2. Generate a cryptographically random opaque refresh token on login and store it in the DB
3. Update POST /login to return both access_token and refresh_token in the response
4. Implement POST /refresh that validates the refresh token against the DB, checks expiry and revocation, and returns a new JWT access token
5. Implement POST /revoke that marks a refresh token as revoked in the DB
6. Write tests for all refresh token flows (happy path, expired, revoked, invalid)
7. Verify all existing tests still pass

## How to Test It

1. Run `pnpm test` from the monorepo root
2. Verify all 12 existing API tests still pass (no regressions)
3. Verify new test: POST /login returns a response body containing both `access_token` and `refresh_token` fields
4. Verify new test: POST /refresh with the refresh_token from login returns a 200 response with a new `access_token`
5. Verify new test: POST /refresh with an expired refresh token returns 401
6. Verify new test: POST /revoke with a valid refresh token returns 200
7. Verify new test: POST /refresh with a revoked refresh token returns 401
8. Verify new test: POST /refresh with a garbage/invalid token returns 401
9. Verify new test: the refresh token stored in the DB has an `expires_at` value 7 days from creation
10. Verify the total test count increased (12 existing + new refresh token tests all pass)

## Risks and Unknowns

- Risk: Generating cryptographically random tokens on Cloudflare Workers requires Web Crypto API's `crypto.getRandomValues` — need to confirm it produces sufficient entropy for token security
- Unknown: Whether the in-memory SQLite test database handles the refresh_tokens table foreign key to users correctly
- Risk: Existing login tests may break if the response shape changes (adding refresh_token field)

## First Move

Add the `refresh_tokens` table to the Drizzle schema file with columns for token, user_id, expires_at, revoked_at, and created_at.
