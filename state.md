# State

## Goal

Implement core auth flows (register, login, token issue/validate) with a working admin dashboard for role and permission management.

## Position

Monorepo is set up with packages/api and packages/dashboard. Hono API serves a health check endpoint. React dashboard renders a placeholder page. Biome linting and Vitest tests pass. No auth logic, database, or real UI exists yet.

## Log

- **Cycle 01:** Set up pnpm monorepo with Hono API and React dashboard. All dev, lint, and test scripts work. See `cycles/01/`
