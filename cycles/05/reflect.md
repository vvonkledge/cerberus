# Reflect — Cycle 05

## What Worked

- Idempotent database creation — checking if the DB exists before creating handled workflow re-runs cleanly
- Turso CLI approach — using the Turso CLI directly in GitHub Actions was straightforward, no custom actions needed
- Clean separation of workflows — having deploy and cleanup as separate workflow files kept each one focused and simple

## What Didn't Work

No significant friction this cycle. Implementation followed the plan as written with no deviations.

## What Changed in Understanding

Turso makes per-PR database lifecycle practically free — creating and destroying databases per PR has negligible cost, making full data isolation between preview environments a no-brainer rather than a tradeoff.

## Product Changes

No product definition changes this cycle.
