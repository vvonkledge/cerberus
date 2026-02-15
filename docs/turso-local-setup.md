# Turso Local Development Setup

## Prerequisites

- [Turso CLI](https://docs.turso.tech/cli/installation) installed (`brew install tursodatabase/tap/turso`)
- pnpm dependencies installed (`pnpm install` from project root)

## Starting a Local Database

Run `turso dev` to start a local sqld server:

```sh
turso dev --port 8080
```

This starts a local libSQL server at `http://127.0.0.1:8080`. No auth token is required for local development.

To persist data across restarts, use the `--db-file` flag:

```sh
turso dev --port 8080 --db-file packages/api/local.db
```

## Running the API Against Local Turso

The API reads `TURSO_DATABASE_URL` from Cloudflare Workers environment variables. For local development, Wrangler loads these from `packages/api/.dev.vars`:

```
TURSO_DATABASE_URL=http://127.0.0.1:8080
```

Then start the API:

```sh
pnpm --filter @cerberus/api dev
```

## Running Tests

Tests use an in-memory SQLite database (`file::memory:`) via `@libsql/client`, so no running Turso instance is needed:

```sh
pnpm --filter @cerberus/api test
```

## Database Client

The database client is created in `packages/api/src/db/client.ts` using Drizzle ORM with the libsql adapter. It accepts a URL and optional auth token:

- **Local dev:** `http://127.0.0.1:8080` (via `turso dev`)
- **Tests:** `file::memory:` (in-memory, no server needed)
- **Production:** Turso cloud URL with auth token

## Schema

Schemas are defined in `packages/api/src/db/schema.ts` using Drizzle's SQLite column builders. Drizzle Kit config is in `packages/api/drizzle.config.ts`.

## Files

| File | Purpose |
|---|---|
| `packages/api/src/db/client.ts` | Database client factory |
| `packages/api/src/db/schema.ts` | Drizzle schema definitions |
| `packages/api/drizzle.config.ts` | Drizzle Kit configuration |
| `packages/api/.dev.vars` | Local environment variables (gitignored) |
