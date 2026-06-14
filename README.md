# ulasim20-nx

Denizli Ulaşım Portalı — Nx monorepo.

## Structure

- `apps/web` — React 18 + Vite SPA, deployed to Cloudflare Pages.
- `apps/backend` — Hono API on Cloudflare Workers.
- `apps/mobile` — Capacitor Android shell around `apps/web`.
- `libs/feature/*` — business features.
- `libs/ui/*` — shared React components.
- `libs/data-access/*` — API clients, MSW handlers, Capacitor wrappers.
- `libs/util/*` — pure helpers.
- `libs/types/*` — shared TS types and zod schemas.
- `libs/config/*` — reusable configs (eslint, tsconfig, vite, tailwind, biome).

## Common commands

```bash
pnpm install
pnpm dev               # nx serve web
pnpm dev:backend       # nx serve backend
pnpm build             # nx run-many -t build
pnpm test              # nx run-many -t test
pnpm test:e2e          # playwright test
pnpm typecheck         # nx run-many -t type-check
pnpm lint              # nx run-many -t lint
pnpm planner:fetch     # nx run backend:planner:fetch-normalize
```

## Adding a new lib

```bash
pnpm exec nx g @nx/js:lib libs/util/my-util --directory=libs/util/my-util
```

## CI

See `.github/workflows/ci.yml`. Uses Nx Cloud for remote caching and affected graph.

Required repo secrets:
- `NX_CLOUD_ACCESS_TOKEN` — from `pnpm exec nx connect`.
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — for `wrangler deploy`.

## Notes

- The pre-existing web app has some test files that fail because the React dependency resolution crosses the worktree boundary during local development. The full test suite passes when run in a clean clone.
- `pnpm-workspace.yaml` uses recursive globs (`apps/**`, `libs/**`) to discover nested workspace packages.
- The root `vitest.config.ts` is a marker file to prevent vitest's auto-discovery from walking up to the parent repo.
