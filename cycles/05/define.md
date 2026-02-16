# Define — Cycle 05

## Problem Statement

Modify the preview deploy workflow to dynamically create a Turso database (cerberus-pr-<N>) and generate a scoped token via the Turso CLI instead of using shared secrets, then push schema and inject the credentials into the worker. Add a cleanup workflow triggered on pull_request: closed that destroys both the database and the preview worker.

## Success Criteria

- [ ] PR deploy creates a database named cerberus-pr-<number>
- [ ] Worker receives DB URL and auth token as secrets
- [ ] Schema is pushed to the per-PR database before deploy
- [ ] Closing a PR destroys the database and preview worker

## Out of Scope

- Not adding seed data or test fixtures to per-PR databases
- Not modifying staging or production deploy workflows
- Not implementing database migration rollback logic
- Not adding a UI or dashboard for managing preview databases
