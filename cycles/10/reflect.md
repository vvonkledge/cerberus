# Reflect — Cycle 10

## What Worked

- The revoke-and-reissue pattern matched the existing revocation flow, so no new patterns were needed
- Reusing generateRefreshToken() from crypto.ts kept the change minimal
- The existing test helpers (loginAndGetTokens, postRefresh) made writing rotation tests fast

## What Didn't Work

- No transaction wrapping between revoke and insert — a failure between them could orphan the user (old token revoked, no new one). Not a problem yet but a known gap.
- The test count math was slightly confusing: 3 new tests added but total went up by 3 (from 35 to 38) because the existing test was updated, not replaced.

## What Changed in Understanding

- Race conditions on concurrent refresh are naturally handled by the revoke-first approach — no extra locking needed
- The refresh_tokens table accumulates rows (each rotation adds one) — eventually a cleanup/pruning strategy may be needed

## Product Changes

No product definition changes this cycle.
