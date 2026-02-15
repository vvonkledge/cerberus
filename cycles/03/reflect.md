# Reflect — Cycle 03

## What Worked

- Wrangler v4's assets feature made bundling React + Hono trivial
- Separate workflow files per trigger kept each config simple
- Running the real test plan caught 3 issues dry-runs missed

## What Didn't Work

- Dry-runs gave false confidence — YAML validation and wrangler dry-run both passed, but real CI failed on missing packageManager field and wrong auth token type
- Wrangler OAuth token is not a Cloudflare API token — spent time trying to reuse it for CI before realizing they're different auth flows
- The plan didn't account for the ASSETS binding change to the Hono app — serving React from a Worker requires code changes, not just config

## What Changed in Understanding

- Deploying Hono + React as a single Worker is simpler than expected — Wrangler v4 assets handle it natively without a custom build pipeline
- Preview workers persist after PR close — we'll need cleanup automation eventually
- The DB middleware running on every request (including static assets) is a design flaw we inherited from Cycle 02 that needs fixing

## Product Changes

No product definition changes this cycle.
