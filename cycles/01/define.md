# Define — Cycle 01

## Problem Statement

Set up a mono-repo with a Hono API and React dashboard that run locally on Cloudflare Workers (via wrangler), so we have a working local dev environment to build on.

## Success Criteria

- [ ] `pnpm dev` starts both the Hono API and React dashboard
- [ ] Hono API responds to a health check at localhost
- [ ] React dashboard loads in the browser at localhost
- [ ] Mono-repo has separate packages for API and dashboard with shared config
- [ ] `pnpm lint` runs Biome for linting and formatting across all packages
- [ ] `pnpm test` runs Vitest and at least one example test passes per package

## Out of Scope

- Not setting up CI/CD pipelines — that's Cycle 02
- Not configuring staging or production environments
- Not setting up Turso database or migrations
- Not implementing any auth logic or API routes beyond health check
- Not writing the React dashboard UI beyond confirming it loads
