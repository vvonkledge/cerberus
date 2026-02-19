# Plan — Cycle 21

## Approach

Follow the refresh token pattern. Add a new `password_reset_tokens` table mirroring the refresh_tokens structure. Implement two endpoints: POST /forgot-password (generates token) and POST /reset-password (consumes token, updates password). Reuse existing PBKDF2 hashing, Web Crypto token generation, and writeAuditLog utility. Mark tokens as used after consumption. Return 200 for non-existent emails on forgot-password to prevent user enumeration.

## Steps

1. Add `password_reset_tokens` table to Drizzle schema (token, userId, expiresAt, usedAt columns)
2. Implement POST /forgot-password — look up user by email, generate opaque reset token via Web Crypto, store in DB with expiry, return token in response (return 200 even for non-existent emails)
3. Implement POST /reset-password — validate token (exists, not expired, not used), hash new password with PBKDF2, update user's password, mark token as used
4. Add audit log entries for forgot-password (password_reset_requested) and reset-password (password_reset_completed / password_reset_failed)
5. Write unit/integration tests covering happy path, expired token, used token, invalid token, and audit log entries

## How to Test It

See [test-plan.md](test-plan.md) for the full test runbook.

## Risks and Unknowns

- Risk: POST /forgot-password for a non-existent email could leak whether an account exists — mitigation: return 200 regardless to prevent user enumeration
- Unknown: What expiry duration to use for reset tokens (e.g., 1 hour, 24 hours) — decide during implementation
- Risk: Without rate limiting (out of scope), the forgot-password endpoint could be abused to generate many tokens — acceptable for now since rate limiting is a future cycle

## First Move

Add the `password_reset_tokens` table to the Drizzle schema file with token, userId, expiresAt, and usedAt columns.
