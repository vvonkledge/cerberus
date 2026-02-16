# Define — Cycle 04

## Problem Statement

Turso database management across all environments — local, preview, staging, and production. Each environment needs its own database connection with migrations applied automatically.

## Success Criteria

- [ ] Migrations run automatically on deploy for each environment (local, preview, staging, production)
- [ ] Health endpoint confirms DB connectivity on each environment

## Out of Scope

- Not implementing any auth logic (user schema, registration, login)
- Not setting up database backups or replication
