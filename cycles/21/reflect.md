# Reflect — Cycle 21

## What Worked

- Reusing the refresh token pattern directly — the `refreshTokens` table structure, `generateRefreshToken()` for opaque token generation, and `hashPassword()`/`verifyPassword()` for PBKDF2 all applied without modification, keeping the codebase consistent and avoiding new infrastructure.
- User enumeration prevention via uniform 200 responses was clean to implement — the handler branches on user existence but always returns 200, with different response bodies (token present vs generic message).
- Existing test patterns (in-memory SQLite + raw CREATE TABLE + Hono test app) transferred directly to the new test file with no friction.
- The `writeAuditLog` utility with `getClientIp()` trivially supported all 4 new event types (password_reset_requested, password_reset_completed, password_reset_failed with specific reasons in metadata).
- Expired token testing via direct Drizzle DB manipulation (`update().set({ expiresAt: pastDate })`) gave precise control without time mocking.

## What Didn't Work

No significant blockers encountered. Implementation proceeded as planned. One implicit assumption noted: the ISO string comparison for expiry checking (`row.expiresAt < new Date().toISOString()`) works because ISO 8601 strings sort lexicographically, but this is an inherited pattern assumption rather than an explicit design choice.

## What Changed in Understanding

No significant changes in understanding. Implementation validated the planned approach. Two learnings solidified: (1) the project's opaque hex token + ISO timestamp expiry + nullable "usedAt" column pattern is a general-purpose, reusable pattern for any token-gated operation beyond refresh and reset; (2) returning uniform error messages to users while logging specific failure reasons in audit metadata is an effective security pattern worth continuing. The current forgot-password API contract (returning the token in the response body) will require a breaking change when email delivery is added in a future cycle — the response should switch to always returning the generic message.

## Product Changes

No product definition changes this cycle. The "Password reset" feature already exists in product.md. The API layer is now implemented; email delivery and dashboard UI remain as future work.
