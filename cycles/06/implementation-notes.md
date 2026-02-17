# Implementation Notes — Cycle 06

## Summary
Added user registration and login endpoints with OAuth 2.0-compatible token responses. Users can register with email/password and authenticate to receive JWT access tokens. All crypto uses Web Crypto API (PBKDF2 for passwords, HMAC-SHA256 for JWT) — no external dependencies added.

## What Was Built
- Users table schema (Drizzle ORM)
- Password hashing and JWT utilities using Web Crypto API
- POST /register endpoint (201 on success, 409 on duplicate, 400 on invalid input)
- POST /login endpoint (200 with OAuth 2.0 token response, 401 on invalid credentials, 400 on invalid input)
- 12 automated tests covering all success criteria

## Files Changed

### Created
- `packages/api/src/auth/crypto.ts` — Password hashing (PBKDF2-SHA256) and JWT (HMAC-SHA256) utilities via Web Crypto API
- `packages/api/src/auth/register.ts` — Hono sub-app for POST /register
- `packages/api/src/auth/login.ts` — Hono sub-app for POST /login
- `packages/api/src/__tests__/register.test.ts` — 4 tests: happy path (201), duplicate email (409), missing email (400), missing password (400)
- `packages/api/src/__tests__/login.test.ts` — 5 tests: valid creds (200 + token), invalid password (401), nonexistent user (401), JWT claims verification, missing fields (400)

### Modified
- `packages/api/src/db/schema.ts` — Added `users` table (id, email, hashed_password, created_at, updated_at)
- `packages/api/src/index.ts` — Added JWT_SECRET to Bindings, imported and mounted /register and /login routes
- `packages/api/.dev.vars` — Added JWT_SECRET for local development

## Decisions Made
- Used Web Crypto API directly for both password hashing and JWT instead of external libraries — zero new dependencies, works natively on Cloudflare Workers
- PBKDF2-SHA256 with 100,000 iterations and 16-byte random salt for password hashing — stored as `salt:hash` hex format
- HMAC-SHA256 for JWT signing — implemented base64url encoding manually to avoid Node.js dependencies
- Auth routes structured as Hono sub-apps (`register.ts`, `login.ts`) mounted on the main app — keeps auth logic modular
- JWT expires in 3600 seconds (1 hour) by default
- Login tests insert users directly into DB rather than calling /register — keeps tests independent

## Plan Deviations
Implementation followed the plan as written.

## Test Results
- Step 1 (pnpm test all pass): PASS — 12 API tests + 1 dashboard test
- Step 2 (register happy path 201): PASS
- Step 3 (register duplicate email 409): PASS
- Step 4 (login valid creds 200 + token): PASS
- Step 5 (login invalid creds 401): PASS
- Step 6 (schema test — user table): PASS
- Step 7 (JWT claims sub, iat, exp): PASS
- Lint: PASS — all files pass Biome checks

## Challenges and Learnings
- Biome's `noNonNullAssertion` rule required using destructured `as` type assertions instead of `!` operator in test assertions after null checks
- Web Crypto API works identically in Vitest (Node.js) and Cloudflare Workers — no compatibility shim needed for the test environment
- The existing test pattern of creating tables via raw SQL and using in-memory SQLite (`file::memory:`) scaled well to the auth tests

## Notes for REFLECT
- JWT_SECRET needs to be configured as a Cloudflare Workers secret for staging/production deploys
- Refresh tokens are intentionally out of scope — next cycle should consider token refresh and session management
- No rate limiting on auth endpoints yet — should be prioritized before production use
- The `$defaultFn` pattern in Drizzle schema means timestamps are set in application code, not at the DB level — test table creation must account for this
