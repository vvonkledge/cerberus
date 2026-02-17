# Reflect — Cycle 06

## What Worked

- Web Crypto API worked identically in Vitest (Node.js) and Cloudflare Workers — no compatibility shim needed, resolving the biggest risk from the plan
- Zero new dependencies — PBKDF2 and HMAC-SHA256 JWT implemented with only built-in APIs
- Hono sub-app pattern — auth routes as separate modules (register.ts, login.ts) kept code modular
- In-memory SQLite test pattern scaled well — raw SQL table creation + file::memory: extended cleanly from health tests to auth tests
- Login tests independent of register — inserting users directly into DB kept tests isolated

## What Didn't Work

- Biome's noNonNullAssertion rule required using destructured `as` type assertions instead of the `!` operator in test assertions after null checks — minor friction but worth knowing for future test code

## What Changed in Understanding

- Web Crypto API is fully sufficient for auth crypto on Cloudflare Workers — no external libraries needed for password hashing or JWT
- JWT_SECRET needs to be configured per environment as a Workers secret for staging and production
- Drizzle's $defaultFn means timestamps are application-level, not DB-level — test table creation must account for this

## Product Changes

No product definition changes this cycle.
