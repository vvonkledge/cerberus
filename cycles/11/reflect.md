# Reflect — Cycle 11

## What Worked

- Eager cleanup approach — cleaning up inline during rotation was simple and avoided the complexity of cron jobs or admin endpoints
- DELETE after INSERT ordering — placing the DELETE after the new token INSERT ensured the new token was never accidentally deleted
- Small, focused scope — one DELETE query plus one test; the cycle was tight and completed quickly with no surprises

## What Didn't Work

- Eager deletion changed the error message for rotated tokens from "Refresh token revoked" to "Invalid refresh token" — a loss of specificity in error responses. Two existing tests needed updated expectations.

## What Changed in Understanding

Realized that eager deletion trades error specificity for DB cleanliness. When revoked tokens are deleted rather than kept, subsequent lookups return a generic "Invalid refresh token" instead of the more specific "Refresh token revoked." This is a trade-off worth being aware of for future auth error handling decisions.

## Product Changes

No product definition changes this cycle.
