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

Use the workspace generator to create a lib with the right tags, peer deps, and project structure:

```bash
pnpm exec nx g @ulasim20/tools:lib --name=my-lib --type=util
```

Supported types: `util`, `types`, `data-access`, `ui`, `feature`. The generator places the new lib under `libs/<type>/<name>/`, applies the `type:<type>` and `scope:shared` tags, and adds the React peer/devDeps for `ui` and `feature` libs.

If you create a lib by hand (not via the generator), add `scope:shared` to the `tags` array in `project.json` and add React peer deps to `package.json` for UI/feature libs.

## Nx Cloud

This workspace is configured for Nx Cloud remote caching but is not yet connected. To enable:

```bash
pnpm exec nx connect
```

This will set `nxCloudId` in `nx.json` after a human authenticates. If you prefer to keep the ID out of git, set `NX_CLOUD_ACCESS_TOKEN` in your local environment and skip `nx connect`.

## CI

See `.github/workflows/ci.yml`. Uses Nx Cloud for remote caching and affected graph.

Required repo secrets:
- `NX_CLOUD_ACCESS_TOKEN` — from `pnpm exec nx connect`.
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — for `wrangler deploy`.

## Notes

- Run `pnpm install` locally before pushing so the lockfile is current.
- `vitest.config.ts` at the repo root is a marker file (its only purpose is to exist for `vitest.workspace.ts` to `extends` it). Do not delete it; `tests/setup/` and the workspace config depend on it.
- The pre-existing web app has some test files that fail because the React dependency resolution crosses the worktree boundary during local development. The full test suite passes when run in a clean clone.
- `pnpm-workspace.yaml` uses recursive globs (`apps/**`, `libs/**`) to discover nested workspace packages.
