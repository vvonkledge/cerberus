# Cerberus - Auth-as-a-Service Platform
# Run `just` to see all available commands

set dotenv-load
set quiet

# List available commands
default:
    @just --list --unsorted

# Start all dev servers (API + dashboard)
[group('dev')]
dev:
    pnpm --parallel -r run dev

# Start API dev server only (localhost:8787)
[group('dev')]
dev-api:
    cd packages/api && pnpm dev

# Start dashboard dev server only
[group('dev')]
dev-dash:
    cd packages/dashboard && pnpm dev

# Install all dependencies
[group('dev')]
install:
    pnpm install

# Run all tests
[group('test')]
test:
    pnpm -r run test

# Run API tests only
[group('test')]
test-api:
    cd packages/api && pnpm test

# Run dashboard tests only
[group('test')]
test-dash:
    cd packages/dashboard && pnpm test

# Run tests in watch mode (package: api or dashboard)
[group('test')]
test-watch package='api':
    cd packages/{{ package }} && npx vitest watch

# Lint all code with Biome
[group('quality')]
lint:
    pnpm lint

# Lint and auto-fix
[group('quality')]
lint-fix:
    pnpm lint:fix

# Run lint + tests (same as CI)
[group('quality')]
check: lint test

# Build dashboard for production
[group('build')]
build:
    pnpm build

# Deploy to staging (requires Cloudflare auth)
[group('build')]
[confirm('Deploy to staging?')]
deploy-staging:
    cd packages/dashboard && pnpm build
    cd packages/api && npx drizzle-kit push
    cd packages/api && npx wrangler deploy --env staging

# Deploy to production (requires Cloudflare auth)
[group('build')]
[confirm('Deploy to PRODUCTION?')]
deploy-prod:
    cd packages/dashboard && pnpm build
    cd packages/api && npx drizzle-kit push
    cd packages/api && npx wrangler deploy --env production

# Push schema to database
[group('db')]
db-push:
    cd packages/api && pnpm db:push

# Generate a new migration
[group('db')]
db-generate:
    cd packages/api && npx drizzle-kit generate

# Open Drizzle Studio
[group('db')]
db-studio:
    cd packages/api && npx drizzle-kit studio

# Seed admin user (local dev)
[group('util')]
seed:
    curl -s -X POST http://localhost:8787/seed | jq .

# Clean build artifacts
[group('util')]
clean:
    rm -rf packages/dashboard/dist
    rm -rf packages/api/.wrangler

# Show project status
[group('util')]
status:
    @echo "=== Git ===" && git status --short
    @echo "\n=== Tests ===" && pnpm -r run test 2>&1 | tail -5
    @echo "\n=== Lint ===" && pnpm lint 2>&1 | tail -3
