# Plan — Cycle 01

## Approach

pnpm workspace with packages/api (Hono + wrangler) and packages/dashboard (React + Vite), shared config at root.

## Steps

1. Initialize pnpm workspace at root with pnpm-workspace.yaml
2. Create packages/api with Hono, wrangler, TypeScript
3. Add health check route to Hono API
4. Create packages/dashboard with React + Vite + Tailwind
5. Configure shared TypeScript tsconfig at root
6. Set up Biome at root with shared config
7. Set up Vitest in each package with an example test
8. Add root package.json scripts (dev, lint, test)

## How to Test It

1. Run `pnpm install` at root — verify it completes without errors
2. Run `pnpm dev` at root — verify both API and dashboard start without errors
3. Run `curl http://localhost:8787/health` — verify it returns a 200 response (health check)
4. Open `http://localhost:5173` in a browser — verify the React dashboard loads
5. Run `pnpm lint` at root — verify Biome runs across all packages with no errors
6. Run `pnpm test` at root — verify Vitest runs and example tests pass in both packages
7. Check that `packages/api/` and `packages/dashboard/` exist as separate packages
8. Check that root `pnpm-workspace.yaml` references both packages

## Risks and Unknowns

- Unknown: Not sure how wrangler dev and Vite dev server interact when running concurrently — may need specific port config
- Risk: Cloudflare Workers runtime has limitations (no Node.js APIs) — Hono should handle this but worth verifying
- Unknown: Not sure if Biome supports all the rules we want out of the box

## First Move

Create root package.json and pnpm-workspace.yaml with the packages/ directory structure.
