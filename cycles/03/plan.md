# Plan — Cycle 03

## Approach

Create separate GitHub Actions workflow files per trigger event (PR, merge to main, tag), each using Wrangler to deploy to the appropriate Cloudflare environment. A wrangler.toml defines preview, staging, and production environments, and a build step bundles the React app into the Hono worker so both are deployed as a single unit.

## Steps

1. Create wrangler.toml with environments (preview, staging, production)
2. Configure build script to bundle React app with Hono worker
3. Create .github/workflows/pr-checks.yml for lint + test on PR
4. Create .github/workflows/preview-deploy.yml to deploy preview on PR
5. Create .github/workflows/staging-deploy.yml to deploy on merge to main
6. Create .github/workflows/production-deploy.yml to deploy on tag

## How to Test It

See [test-plan.md](test-plan.md) for the full test runbook.

## Risks and Unknowns

- Risk: React bundling into the Hono worker may not work seamlessly — may need a custom build pipeline
- Unknown: Not sure how Wrangler handles preview environments with unique URLs per PR
- Risk: GitHub Actions secrets for Cloudflare API token need to be configured in the repo settings
- Unknown: Whether the monorepo structure requires special Wrangler configuration for the build output path

## First Move

Create wrangler.toml at the project root with the basic worker configuration and environment definitions (preview, staging, production), then test a local wrangler dev run.
