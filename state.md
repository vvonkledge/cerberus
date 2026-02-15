# State

## Goal

Implement core auth flows (register, login, token issue/validate) with a working admin dashboard for role and permission management.

## Position

Monorepo with packages/api and packages/dashboard deployed as a single Cloudflare Worker via Wrangler v4 assets. CI/CD pipeline runs lint and tests on PRs, deploys per-PR previews, auto-deploys staging on merge to main, and deploys production on git tag. Hono API serves a health endpoint with a defensive DB middleware (skips when Turso not configured). React dashboard renders a placeholder page. Turso secrets are not yet configured on deployed environments. No auth logic, user schema, or real UI exists.

## Log

- **Cycle 01:** Set up pnpm monorepo with Hono API and React dashboard. All dev, lint, and test scripts work. See `cycles/01/`
- **Cycle 02:** Added Turso database layer with Drizzle ORM and libsql adapter. Local dev via turso dev CLI, tests via in-memory SQLite, Workers compatibility confirmed. See `cycles/02/`
- **Cycle 03:** Added CI/CD pipeline with GitHub Actions: PR checks (lint + test), per-PR preview deploys, staging on merge to main, production on tag. Hono + React deployed as a single Cloudflare Worker. All 4 criteria verified end-to-end. See `cycles/03/`
