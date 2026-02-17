# State

## Goal

Implement core auth flows (register, login, token issue/validate) with a working admin dashboard for role and permission management.

## Position

Monorepo with packages/api and packages/dashboard deployed as a single Cloudflare Worker. CI/CD pipeline runs lint and tests on PRs, deploys per-PR previews with dynamically created Turso databases, auto-deploys staging on merge to main, and deploys production on tag. Each deploy runs `drizzle-kit push` against its environment's Turso database. A cleanup workflow destroys the per-PR database and preview worker on PR close. The per-PR database workflow has been statically verified but not E2E tested — a `TURSO_API_TOKEN` secret must be configured before live testing. Users table and refresh_tokens table exist. POST /register creates users with PBKDF2-hashed passwords. POST /login verifies credentials and returns an OAuth 2.0-compatible JWT access token (HMAC-SHA256, 1-hour expiry) alongside an opaque refresh token (7-day expiry). POST /refresh exchanges a valid refresh token for a new access token. POST /revoke invalidates a refresh token. All crypto uses Web Crypto API with zero external dependencies. JWT_SECRET must be configured as a Workers secret for staging and production. 19 API tests and 1 dashboard test pass. React dashboard renders a placeholder page. No token rotation, rate limiting, roles, permissions, or admin UI exists.

## Log

- **Cycle 01:** Set up pnpm monorepo with Hono API and React dashboard. All dev, lint, and test scripts work. See `cycles/01/`
- **Cycle 02:** Added Turso database layer with Drizzle ORM and libsql adapter. Local dev via turso dev CLI, tests via in-memory SQLite, Workers compatibility confirmed. See `cycles/02/`
- **Cycle 03:** Added CI/CD pipeline with GitHub Actions: PR checks (lint + test), per-PR preview deploys, staging on merge to main, production on tag. Hono + React deployed as a single Cloudflare Worker. All 4 criteria verified end-to-end. See `cycles/03/`
- **Cycle 04:** Configured Turso databases for preview, staging, and production. CI/CD deploys now run `drizzle-kit push` before each deploy, and the health endpoint verifies DB connectivity on all environments. See `cycles/04/`
- **Cycle 05:** Implemented per-PR Turso database lifecycle in preview deploys. Cleanup workflow destroys database and worker on PR close. See `cycles/05/`
- **Cycle 06:** Implemented user registration and login with OAuth 2.0-compatible JWT access tokens. All crypto via Web Crypto API with zero new dependencies. All 5 success criteria met with 12 passing tests. See `cycles/06/`
- **Cycle 07:** Added refresh token support with 7-day expiry and revocation. 19 tests pass with zero regressions. See `cycles/07/`
