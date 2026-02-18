# Plan — Cycle 13

## Approach

Create a Hono middleware function that extracts the JWT from the Authorization: Bearer header, verifies it using the existing JWT verification logic, and returns 401 if the token is missing or invalid. Apply the middleware to all RBAC route groups so that only authenticated requests can access role and permission management endpoints.

## Steps

1. Create an auth middleware function that extracts JWT from Authorization: Bearer header and verifies it using existing JWT logic — returns 401 if missing or invalid, sets user context if valid.
2. Apply the middleware to all RBAC routes (POST /roles, GET /roles, POST /roles/:roleId/permissions, GET /users, POST /users/:userId/roles, GET /users/:userId/permissions).
3. Update existing RBAC tests to include a valid JWT in requests so they keep passing.
4. Add new tests that call each RBAC endpoint without a JWT and assert 401 response.

## How to Test It

1. **Action:** Run `pnpm test` from the project root. **Verify:** All existing tests pass (zero failures).
2. **Action:** Find the new test(s) that call an RBAC endpoint without an Authorization header. **Verify:** They assert a 401 status code response.
3. **Action:** Find the new test(s) that call an RBAC endpoint with an invalid/malformed JWT. **Verify:** They assert a 401 status code response.
4. **Action:** Find the existing RBAC tests (POST /roles, GET /roles, etc.). **Verify:** They now include an Authorization: Bearer <token> header in requests.
5. **Action:** Run `pnpm test` again after any changes. **Verify:** All tests pass including the new 401 tests.

## Risks and Unknowns

- Risk: Existing RBAC tests will break once middleware is applied — mitigation: update tests to send valid JWTs before or alongside applying the middleware.
- Unknown: Need to check how JWT verification is currently structured — it may need to be extracted into a reusable function if it's inline in the login handler.

## First Move

Read the current JWT verification code (likely in the login handler or a shared auth module) to understand how to extract it into a reusable middleware function.
