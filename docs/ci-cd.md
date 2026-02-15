# CI/CD Pipeline

## Overview

Cerberus uses GitHub Actions with Cloudflare Workers for CI/CD. The Hono API and React dashboard are deployed as a single Worker — the dashboard is built to static assets, and the Worker serves both API routes and the SPA.

## Environments

| Environment | Worker Name | Trigger | URL |
|---|---|---|---|
| Preview | `cerberus-preview-pr-<N>` | Pull request opened/updated | `https://cerberus-preview-pr-<N>.alexandre-leroy.workers.dev` |
| Staging | `cerberus-staging` | Merge to `main` | `https://cerberus-staging.alexandre-leroy.workers.dev` |
| Production | `cerberus-production` | Git tag `v*` pushed | `https://cerberus-production.alexandre-leroy.workers.dev` |

## Workflows

### PR Checks (`.github/workflows/pr-checks.yml`)
- **Trigger:** Pull request to `main`
- **Jobs:** Lint (Biome) and Test (Vitest) run in parallel
- **No Cloudflare credentials needed**

### Preview Deploy (`.github/workflows/preview-deploy.yml`)
- **Trigger:** Pull request to `main`
- **Creates a unique Cloudflare Worker per PR** using `--name cerberus-preview-pr-<number>`
- **Posts a comment on the PR** with the preview URL

### Staging Deploy (`.github/workflows/staging-deploy.yml`)
- **Trigger:** Push to `main` (including PR merges)
- **Deploys using** `wrangler deploy --env staging`

### Production Deploy (`.github/workflows/production-deploy.yml`)
- **Trigger:** Tag push matching `v*` (e.g., `v0.1.0`, `v1.0.0`)
- **Deploys using** `wrangler deploy --env production`

## Required Secrets

Set these in GitHub repo Settings > Secrets and variables > Actions:

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with "Edit Cloudflare Workers" permission. Create at https://dash.cloudflare.com/profile/api-tokens using the "Edit Cloudflare Workers" template. Select the account `062f9ed0cfb95a028cb4b55b30a6c71d`. |

## Wrangler Configuration

The wrangler config is at `packages/api/wrangler.jsonc`. Key points:

- `account_id` is set to `062f9ed0cfb95a028cb4b55b30a6c71d`
- `assets.directory` points to `../dashboard/dist` (the Vite build output)
- `assets.not_found_handling` is `single-page-application` for React client-side routing
- Environments `staging` and `production` override the worker name

## How Deployment Works

1. `pnpm build` builds the React dashboard to `packages/dashboard/dist/`
2. `wrangler deploy` (from `packages/api/`) bundles the Hono worker and uploads the dashboard assets
3. The Worker serves API routes (e.g., `/health`) directly
4. Non-API GET requests fall through to the ASSETS binding, which serves the React SPA
5. Unknown routes return `index.html` (SPA fallback)

## Database Secrets

Each environment needs Turso credentials configured as Wrangler secrets:

```sh
# From packages/api/
npx wrangler secret put TURSO_DATABASE_URL --env staging
npx wrangler secret put TURSO_AUTH_TOKEN --env staging
npx wrangler secret put TURSO_DATABASE_URL --env production
npx wrangler secret put TURSO_AUTH_TOKEN --env production
```

The DB middleware is defensive — if `TURSO_DATABASE_URL` is not set, it skips database initialization. The `/health` endpoint works without it.

## Releasing

```sh
# Staging: merge a PR to main (automatic)
gh pr merge <number> --merge

# Production: tag and push
git tag v0.2.0
git push origin v0.2.0
```
