# Test Plan — Cycle 06

> Step-by-step verification runbook for success criteria defined in define.md.

## Prerequisites

- Project dependencies installed (`pnpm install`)
- For manual tests: dev server running via `pnpm --filter api dev`

## Test Steps

### Automated (via `pnpm test`)

1. **Action:** Run `pnpm test` from the project root
   **Verify:** All tests pass with exit code 0

2. **Verify:** Test output includes tests for POST /register (happy path — returns 201)

3. **Verify:** Test output includes tests for POST /register (duplicate email — returns 409)

4. **Verify:** Test output includes tests for POST /login (valid credentials — returns 200 with access_token, token_type, expires_in)

5. **Verify:** Test output includes tests for POST /login (invalid credentials — returns 401)

6. **Verify:** Test output includes a schema test (user table created and queried)

7. **Verify:** The returned access_token is a valid JWT with expected claims (sub, iat, exp)

### Manual (via curl against dev server)

8. **Action:** Run `pnpm --filter api dev` to start the dev server
   **Verify:** Server starts on http://localhost:8787

9. **Action:** `curl -X POST http://localhost:8787/register -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"testpass123"}'`
   **Verify:** Response status 201, body contains user email

10. **Action:** `curl -X POST http://localhost:8787/login -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"testpass123"}'`
    **Verify:** Response status 200, body contains access_token, token_type is "Bearer", expires_in is a number

11. **Action:** `curl -X POST http://localhost:8787/login -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"wrongpassword"}'`
    **Verify:** Response status 401

## Success Criteria Coverage

| Success Criterion | Verified by Step(s) |
|---|---|
| POST /register creates a user with hashed password and returns 201 | Steps 2, 9 |
| POST /login with valid credentials returns an OAuth 2.0-compatible access token | Steps 4, 7, 10 |
| POST /login with invalid credentials returns 401 | Steps 5, 11 |
| User table exists with email, hashed password, and timestamps | Step 6 |
| All new endpoints have passing tests | Steps 1, 2-7 |
