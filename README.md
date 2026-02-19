# Cerberus

[![CI](https://github.com/vvonkledge/cerberus/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/vvonkledge/cerberus/actions/workflows/pr-checks.yml)
[![Staging Deploy](https://github.com/vvonkledge/cerberus/actions/workflows/staging-deploy.yml/badge.svg)](https://github.com/vvonkledge/cerberus/actions/workflows/staging-deploy.yml)
[![Production Deploy](https://github.com/vvonkledge/cerberus/actions/workflows/production-deploy.yml/badge.svg)](https://github.com/vvonkledge/cerberus/actions/workflows/production-deploy.yml)

Auth-as-a-service for solo developers. One centralized authentication and authorization backend for all your web applications.

**Live environments:**
[Production](https://cerberus-production.alexandre-leroy.workers.dev) |
[Staging](https://cerberus-staging.alexandre-leroy.workers.dev)

## What is this project, really?

Cerberus is an experiment in **agent-driven development**. The entire implementation — every line of code, every test, every CI/CD pipeline — was written exclusively by AI agents. Humans participate only through four direction files:

| File | Purpose |
|------|---------|
| `product.md` | What to build |
| `state.md` | Where we are |
| `stack.md` | What tools to use |
| `practices.md` | How to work |

That's the boundary. Humans set direction; agents ship code.

Development is organized into **cycles** (18 completed so far), each producing a traceable set of artifacts: definition, plan, implementation notes, test plan, and reflection. The full history lives in `cycles/`.

## What Cerberus does

- **Registration & login** with PBKDF2-hashed passwords
- **OAuth 2.0-compatible JWTs** (HS256, 1-hour expiry) + 7-day refresh tokens
- **Token rotation** — refresh issues new tokens and revokes old ones
- **Role-based access control** — roles, permissions, user-role assignment
- **Rate limiting** — sliding window via Cloudflare KV
- **Admin dashboard** — React SPA with protected routes, auto token refresh, localStorage persistence

## Architecture

```
┌─────────────────────────────────────────┐
│         Cloudflare Worker (single)       │
│                                         │
│   Hono API ──────────┐                  │
│   POST /register     │                  │
│   POST /login        │  React Dashboard │
│   POST /refresh      │  (static assets  │
│   POST /revoke       │   via ASSETS     │
│   POST /seed         │   binding)       │
│   GET/POST /roles    │                  │
│   GET/POST /users    │                  │
│   GET /health        │                  │
└──────────┬──────────────────────────────┘
           │
     ┌─────┴─────┐
     │   Turso   │
     │  (SQLite) │
     └───────────┘
```

Monorepo with two packages:

- **`packages/api`** — Hono on Cloudflare Workers, Drizzle ORM, Turso
- **`packages/dashboard`** — React 19, Vite, Tailwind CSS

Both compile into a single Worker. The API serves routes directly; everything else falls through to the SPA.

## Stack

TypeScript · Hono · React 19 · Tailwind CSS · Turso · Cloudflare Workers · Drizzle ORM · Vitest · Biome · pnpm

## Getting started

```bash
pnpm install
```

Local development (runs API + dashboard in parallel):

```bash
pnpm dev
```

Run all tests (107 passing):

```bash
pnpm test
```

Lint:

```bash
pnpm lint
```

## Deployment

Three environments managed by GitHub Actions:

- **Preview** — per-PR Worker + dedicated Turso database, auto-cleaned on PR close
- **Staging** — deploys on merge to `main`
- **Production** — deploys on tag push (`v*`)

Each deployment runs `drizzle-kit push` against its environment's Turso database.

## Project structure

```
cerberus/
├── packages/
│   ├── api/                 # Auth API (Hono + Cloudflare Workers)
│   │   ├── src/
│   │   │   ├── auth/        # Register, login, refresh, revoke, crypto
│   │   │   ├── rbac/        # Roles, permissions, user-roles
│   │   │   ├── middleware/   # Auth, authorization, rate-limiting
│   │   │   ├── db/          # Schema and client
│   │   │   └── __tests__/   # 85 tests (including 27 E2E journeys)
│   │   └── wrangler.jsonc
│   └── dashboard/           # Admin UI (React + Vite)
│       ├── src/
│       │   ├── pages/       # Roles, Users, Login, detail views
│       │   ├── auth-context.tsx
│       │   ├── api-client.ts
│       │   └── __tests__/   # 22 tests
│       └── vite.config.ts
├── cycles/                  # Development cycle artifacts (18 cycles)
├── docs/                    # CI/CD and setup documentation
├── product.md               # Human: what to build
├── state.md                 # Human: current project state
└── stack.md                 # Human: technology choices
```

## The experiment

The question driving this project: **can agents build a production-grade service given only high-level human direction?**

The rules are simple:

1. Humans write direction files only (`product.md`, `state.md`, `stack.md`, `practices.md`)
2. Agents do everything else — architecture, implementation, testing, deployment, documentation
3. Each development cycle is self-contained with full traceability

After 18 cycles: 107 passing tests, full CI/CD with per-PR previews, a working admin dashboard, and a deployed auth service. The `cycles/` directory is the audit trail.
