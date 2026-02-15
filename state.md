# State

## Goal

Implement core auth flows (register, login, token issue/validate) with a working admin dashboard for role and permission management.

## Position

Monorepo with packages/api and packages/dashboard. Hono API has a health endpoint and a Drizzle ORM database layer connected to Turso via @libsql/client. Local dev uses turso dev CLI; tests use in-memory SQLite. Workers compatibility is confirmed. React dashboard renders a placeholder page. No auth logic, user schema, or real UI exists yet.

## Log

- **Cycle 01:** Set up pnpm monorepo with Hono API and React dashboard. All dev, lint, and test scripts work. See `cycles/01/`
- **Cycle 02:** Added Turso database layer with Drizzle ORM and libsql adapter. Local dev via turso dev CLI, tests via in-memory SQLite, Workers compatibility confirmed. See `cycles/02/`
