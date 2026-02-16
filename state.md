# State

## Goal

Implement core auth flows (register, login, token issue/validate) with a working admin dashboard for role and permission management.

## Position

Monorepo with packages/api and packages/dashboard deployed as a single Cloudflare Worker. CI/CD pipeline runs lint and tests on PRs, deploys per-PR previews, auto-deploys staging on merge to main, and deploys production on tag. Each deploy runs `drizzle-kit push` against its environment's Turso database. Health endpoint verifies DB connectivity on all environments (local, preview, staging, production). React dashboard renders a placeholder page. No auth logic, user schema, or real UI exists.

## Log

- **Cycle 01:** Set up pnpm monorepo with Hono API and React dashboard. All dev, lint, and test scripts work. See `cycles/01/`
- **Cycle 02:** Added Turso database layer with Drizzle ORM and libsql adapter. Local dev via turso dev CLI, tests via in-memory SQLite, Workers compatibility confirmed. See `cycles/02/`
- **Cycle 03:** Added CI/CD pipeline with GitHub Actions: PR checks (lint + test), per-PR preview deploys, staging on merge to main, production on tag. Hono + React deployed as a single Cloudflare Worker. All 4 criteria verified end-to-end. See `cycles/03/`
- **Cycle 04:** Configured Turso databases for preview, staging, and production. CI/CD deploys now run `drizzle-kit push` before each deploy, and the health endpoint verifies DB connectivity on all environments. See `cycles/04/`
