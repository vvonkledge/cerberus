# Test Plan — Cycle 23

> Step-by-step verification runbook for success criteria defined in define.md.

## Prerequisites

- Monorepo dependencies installed (`pnpm install`)
- Test environment uses in-memory SQLite (no external DB needed)

## Test Steps

1. **Action:** Run `pnpm test` from the monorepo root.
   **Verify:** All existing 172 tests still pass (zero regressions).

2. **Action:** In an API test, POST /register a new user, POST /login to get a JWT, then POST /api-keys with `{ "name": "my-service-key" }` using the JWT Bearer token.
   **Verify:** Response is 201 with a JSON body containing `id`, `name`, `keyPrefix`, and `key` fields. The `key` field starts with `crb_`.

3. **Action:** POST /api-keys again with a different name using the same JWT.
   **Verify:** A second key is created with a different `key` value.

4. **Action:** GET /api-keys using the JWT Bearer token.
   **Verify:** Response is 200 with an array containing both keys. Each entry has `id`, `name`, `keyPrefix`, `createdAt` but does NOT have `key` or `keyHash` fields.

5. **Action:** Make a GET /api-keys request using the raw API key from step 2 as a Bearer token (instead of JWT).
   **Verify:** Response is 200 and returns the same list — proving the API key authenticates successfully.

6. **Action:** DELETE /api-keys/:keyId using the JWT Bearer token, targeting the key from step 2.
   **Verify:** Response is 200. The key is now revoked.

7. **Action:** Make a GET /api-keys request using the revoked API key as Bearer token.
   **Verify:** Response is 401 — revoked keys cannot authenticate.

8. **Action:** GET /api-keys using the JWT Bearer token.
   **Verify:** The revoked key has a non-null `revokedAt` field.

9. **Action:** GET /audit-logs using the JWT (user must have manage_users permission via /seed).
   **Verify:** Audit log entries exist with event_type `api_key_created` and `api_key_revoked` with correct metadata.

10. **Action:** POST /api-keys without any Bearer token.
    **Verify:** Response is 401.

11. **Action:** DELETE /api-keys/:keyId where keyId belongs to a different user.
    **Verify:** Response is 404 (cannot revoke another user's key).

## Success Criteria Coverage

| Success Criterion | Verified by Step(s) |
|---|---|
| POST /api-keys creates an API key and returns the raw key exactly once | Steps 2, 3 |
| GET /api-keys lists all keys for the authenticated user (key values are masked) | Step 4 |
| DELETE /api-keys/:keyId revokes a key and it can no longer authenticate | Steps 6, 7, 8 |
| A request with a valid API key in the Authorization header is authenticated | Step 5 |
| API key creation and revocation are recorded in audit logs | Step 9 |
