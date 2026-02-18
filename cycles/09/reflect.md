# Reflect — Cycle 09

## What Worked

- Splitting API and dashboard into parallel workers — backend GET endpoints and frontend pages were built simultaneously with no file conflicts
- Hono catch-all route + React Router integration just worked — the plan identified this as a risk, but the catch-all `app.get("*", ...)` serving ASSETS made client-side routing seamless with zero configuration

## What Didn't Work

- The plan assumed the permissions endpoint accepted an array (`{"permissions": [...]}`) but the existing API takes a single string (`{"permission": "..."}`). Minor mismatch — the dashboard adapted without significant rework.

## What Changed in Understanding

No significant changes in understanding this cycle. The problem and solution matched expectations.

## Product Changes

No product definition changes this cycle.
