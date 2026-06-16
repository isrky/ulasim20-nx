# ulasim20-nx — Nx Monorepo Migration Design

**Date:** 2026-06-14
**Status:** Approved (pending user review of this document)
**Scope:** Convert the existing `ulasim20-reborn` repository into a pnpm + Nx monorepo with shared libraries, enforced module boundaries, and Nx Cloud-backed CI.

## Goals

1. **Share code** between the React SPA, the Hono backend, and CF Pages Functions through well-defined library packages (no duplicated types, validation, or fetch wrappers).
2. **Speed up builds and CI** using Nx's task graph, project-level caching, and Nx Cloud remote cache.
3. **Enforce architecture boundaries** with tags and an ESLint module-boundaries rule so cross-scope and cross-type imports are caught in CI.
4. **Scale to additional apps** (admin panel, CLI, future mobile platforms) without reorganizing.

The migration is a **big-bang, single-PR** change: one atomic commit series that lands the entire new structure. A hybrid mid-state is not maintained.

## Top-level layout

```
ulasim20-nx/
├── apps/
│   ├── web/              # React 18 + Vite + TS, deploys to Cloudflare Pages
│   │   ├── src/          # was repo-root src/
│   │   ├── functions/    # CF Pages Functions (was repo-root functions/)
│   │   ├── public/       # was repo-root public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── project.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── backend/          # Hono on Cloudflare Workers
│   │   ├── src/          # was backend/src/
│   │   ├── scripts/      # was backend/scripts/ (planner-ci.ts etc.)
│   │   ├── wrangler.toml
│   │   ├── vitest.config.ts
│   │   ├── project.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── mobile/           # Capacitor Android shell
│       ├── android/      # native project, kept inside apps/mobile/
│       ├── capacitor.config.ts
│       ├── project.json
│       └── package.json
├── libs/
│   ├── feature/          # business features (one per domain)
│   ├── ui/               # shared React + Tailwind components
│   ├── data-access/      # API clients, MSW handlers, Capacitor wrappers
│   ├── util/             # pure helpers
│   ├── types/            # shared TS types and zod schemas
│   └── config/           # reusable eslint, tsconfig, vite, tailwind, biome presets
├── tools/                # local Nx generators and executors
├── e2e/                  # Playwright E2E (kept at repo root)
├── tests/                # shared test setup files (vitest setup, MSW server)
├── .github/workflows/    # CI
├── docs/
├── nx.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── vitest.workspace.ts
├── playwright.config.ts
├── biome.json
└── README.md
```

## Apps

### `apps/web`
- React 18 + Vite + TypeScript SPA.
- Owns routing, page composition, top-level providers.
- Imports UI and feature libs (e.g. `@ulasim20/feature-routes`, `@ulasim20/ui`).
- Build output: `apps/web/dist/`. Vite config in `apps/web/vite.config.ts` extends `@ulasim20/config-vite`.
- `functions/` lives inside `apps/web/functions/` so Cloudflare Pages discovers it next to `dist/` with no copy step. This matches CF's official convention and keeps the SPA + edge handlers as a single deploy unit.
- Capacitor config: lives in `apps/mobile/capacitor.config.ts` with `webDir: '../web/dist'`. Web itself does not need to know about Capacitor.

### `apps/backend`
- Hono on Cloudflare Workers (`wrangler dev` / `wrangler deploy`).
- Wrangler config in `apps/backend/wrangler.toml`. Service binding `BACKEND = ulasim-backend` and `BACKEND_URL` var are preserved.
- Planner scripts (`planner-ci.ts`) become Nx targets on the backend project: `nx run backend:planner-fetch`, etc.
- Depends on `@ulasim20/types` and any feature libs that own shared validation schemas.

### `apps/mobile`
- Capacitor Android shell.
- `apps/mobile/capacitor.config.ts` is the source of truth. `webDir: '../web/dist'` points at the built web app. The Android project is at `apps/mobile/android/`.
- Tasks: `cap:sync` (runs `cap sync android`), `android:build` (gradle), `android:open` (opens Android Studio), `lint`, `type-check`.

## Libs

### `libs/feature/*`
Business features, one per domain. Each composes `ui`, `data-access`, `util`, and `types`.

- `feature-routes` — route planning, GTFS/GeoJSON loading, map state.
- `feature-planner` — offline dataset pipeline logic (the planner-ci pipeline). Shared between backend scripts and any web-side consumer.
- `feature-vehicles` — live vehicle tracking, vehicle details.
- `feature-notifications` — Capacitor local notifications, push, in-app toasts.
- `feature-auth` — auth/session (whatever the backend exposes).

Each lib exports a top-level component or hook so apps don't reach into internals.

### `libs/ui/*`
Pure React + Tailwind, no domain logic.

- `ui-primitives` — Button, Input, Dialog (Radix wrappers in the shadcn-style setup), and other form/control primitives.
- `ui-layout` — AppShell, PageHeader, Tabs, Sidebar, Resizable panels.
- `ui-map` — Leaflet wrappers used by `feature-routes` and `feature-vehicles`.
- `ui-icons` — lucide-react re-exports / icon registry.
- `ui-theme` — Tailwind config tokens, theme provider, `next-themes` adapter.

### `libs/data-access/*`
Side-effectful code: API clients, fetch wrappers, MSW handlers, cache.

- `data-access-api-client` — fetch wrapper with error handling, used by web and functions.
- `data-access-transport-api` — typed client for the backend's transport endpoints.
- `data-access-msw-handlers` — shared MSW handlers (currently in `tests/`).
- `data-access-capacitor` — typed wrappers around Capacitor plugins (geo, notifications, haptics, preferences, share).

### `libs/util/*`
Pure, no React, no I/O. Easy to unit test.

- `util-date` — date-fns helpers.
- `util-geo` — haversine, bbox, coordinate math.
- `util-format` — string/number formatting.
- `util-validation` — cross-cutting zod schemas.

### `libs/types/*`
Cross-cutting TS types and zod schemas.

- `types-transport` — Route, Stop, Vehicle, Trip shapes.
- `types-api` — request/response envelopes.
- `types-env` — env var parsing (zod) shared by web, functions, and backend.

### `libs/config/*`
Reusable configs, consumed by every project.

- `config-tsconfig` — base `tsconfig.base.json` and per-project presets.
- `config-eslint` — flat-config presets including the module-boundary rule.
- `config-vite` — shared Vite plugins, tailwind wiring, postcss.
- `config-tailwind` — shared tailwind preset (theme tokens, plugins).
- `config-biome` — base `biome.json` for non-architectural lint+format.

## Cross-cutting wiring

### Package manager
- pnpm with `pnpm-workspace.yaml` listing `apps/*` and `libs/*`.
- Root `package.json` declares `"packageManager": "pnpm@<version>"` for Corepack pinning.
- Each app and lib has its own `package.json` with its own deps. Root keeps only workspace tooling (Nx, biome, typescript).

### Imports
- Public packages use the `@ulasim20/*` scope: `@ulasim20/feature-routes`, `@ulasim20/types-transport`, etc.
- Path mappings in `tsconfig.base.json` resolve them to the lib's `src/index.ts`.
- ESLint `no-restricted-imports` rule bans deep imports across package boundaries (e.g. `@ulasim20/feature-routes/src/internal/x` is not allowed from another lib).

### TypeScript
- `tsconfig.base.json` at root with compiler options + path mappings.
- Each app/lib has a `tsconfig.json` that extends `tsconfig.base.json` and constrains `include`.
- `tsc --build` (Nx's `type-check` target) handles project references incrementally.

### Linting and formatting
- Biome remains the general-purpose linter + formatter.
- ESLint is added on top **only** to enforce the `@nx/enforce-module-boundaries` rule (biome does not cover this).
- `pnpm check` runs biome + eslint + tsc per affected project.

### Boundaries (tags + ESLint)

`nx.json` tags:
- **Scope tags:** `scope:web`, `scope:backend`, `scope:mobile`.
- **Type tags:** `type:feature`, `type:ui`, `type:data-access`, `type:util`, `type:types`, `type:config`.

ESLint `enforce-module-boundaries` rules:
- A project with `scope:*` can only import from the same scope or from projects with no `scope` (shared libs).
- `type:feature` can import `type:ui`, `type:data-access`, `type:util`, `type:types`.
- `type:ui` can import only `type:util`, `type:types`.
- `type:data-access` can import only `type:util`, `type:types`.
- `type:util` and `type:types` cannot import from any other project in this workspace.
- `type:config` is a build-time dep only; it is excluded from the runtime import graph.

## Nx configuration

### `nx.json`
- `targetDefaults`:
  - `build` — depends on `^build`, cache `true`, inputs `["production", "{projectRoot}/**/*"]`.
  - `test` — depends on `^build`, cache `true`, inputs `["default", "{projectRoot}/**/*", "{workspaceRoot}/vitest.workspace.ts"]`.
  - `lint` — cache `true`, depends on `^build` for type-aware rules.
  - `type-check` — cache `true`.
- `namedInputs`:
  - `production` = `["default", "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)"]`.
  - `default` = standard excludes (`*.md`, `node_modules`, `dist`, etc.).
- `defaultBase` = `main`.
- `nxCloudId` set after `nx connect`.

### Tasks per project
- `apps/web`: `build`, `dev`, `lint`, `type-check`, `test` (vitest frontend), `e2e` (playwright), `deploy` (wrangler pages).
- `apps/backend`: `build`, `dev`, `lint`, `type-check`, `test` (vitest backend), `planner:fetch-normalize`, `planner:compute-source-signature`, `planner:compile-dataset`, `planner:validate-dataset`, `planner:promote-manifest`, `deploy` (wrangler).
- `apps/mobile`: `cap:sync`, `android:build`, `android:open`, `lint`, `type-check`.
- `libs/*`: `build` (tsc; for React libs the build is a no-op since we consume source via path mappings), `lint`, `type-check`, `test` (when tests exist).

## Testing

### Vitest workspace
- `vitest.workspace.ts` stays at repo root, projects updated:
  - `frontend` — `apps/web/src/**`, `libs/feature/**/src/**.test.tsx`, `libs/ui/**/src/**.test.tsx`, `libs/data-access/**/src/**/*.test.{ts,tsx}`.
  - `node` — `apps/backend/src/**/*.test.ts`, `libs/util/**/src/**/*.test.ts`, `libs/types/**/src/**/*.test.ts`, plus existing `tests/unit`, `tests/integration`.
  - `backend` — `apps/backend/vitest.config.ts` (Cloudflare Workers pool).
- Setup files in `tests/setup/` remain at repo root and are referenced by absolute path.

### Playwright
- `playwright.config.ts` stays at repo root.
- `webServer` uses `pnpm exec nx run web:preview` so it waits for the built SPA.

## CI

`.github/workflows/ci.yml`:
- Triggers: PR + push to `main`.
- Steps:
  1. Setup pnpm + Node 20 + pnpm cache.
  2. `pnpm install --frozen-lockfile`.
  3. `pnpm exec nx-cloud start-ci-run`.
  4. `pnpm exec nx affected -t lint type-check test build --parallel=2 --ci`.
  5. `pnpm exec nx affected -t e2e --parallel=1` (on main only, gated by env).
  6. On main after green: `nx affected -t deploy` for any changed deployable app.
- Secrets: `NX_CLOUD_ACCESS_TOKEN`.

## Root scripts

`package.json` (root):
- `dev` → `nx serve web` (and `nx run-many -t dev` for backend too if needed).
- `build` → `nx run-many -t build`.
- `test`, `lint`, `typecheck`, `format` → all routed through `nx run-many -t <task>` (or `nx affected` in CI).
- `planner:*` → `nx run backend:planner:<subcommand>` (e.g. `nx run backend:planner:fetch-normalize`).
- `"engines": { "node": ">=20", "pnpm": ">=9" }`.

## Migration steps (preview)

1. **Bootstrap Nx workspace** — `pnpm dlx nx@latest init`, add `nx.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`, pin pnpm in `package.json`.
2. **Add ESLint for boundaries** — `libs/config/eslint` with the module-boundary rule.
3. **Create shared config libs** — `libs/config/{tsconfig,eslint,vite,tailwind,biome}` (everything depends on these).
4. **Create types + util libs** — `libs/types/{transport,api,env}`, `libs/util/{date,geo,format,validation}`. Move shared types/schemas from `src/types/`, `src/utils/`, and `backend/src/` into them. Wire imports.
5. **Create data-access libs** — `libs/data-access/{api-client,transport-api,msw-handlers,capacitor}`. Move `src/api/`, MSW handlers, Capacitor wrappers.
6. **Create ui libs** — `libs/ui/{primitives,layout,map,icons,theme}`. Move generic components from `src/components/`.
7. **Create feature libs** — `libs/feature/{routes,planner,vehicles,notifications,auth}`. Move domain-specific components/hooks/logic. Largest move.
8. **Create `apps/web`** — move `src/`, `index.html`, `vite.config.ts`, `public/`, `functions/`. Update imports. Verify `nx serve web`, `nx test web`, `nx e2e web` all pass.
9. **Create `apps/backend`** — move `backend/*` into `apps/backend/*`. Update wrangler paths. Planner subcommands (`fetch-normalize`, `compute-source-signature`, `compile-dataset`, `validate-dataset`, `promote-manifest`) become targets. Verify `nx serve backend`, `nx test backend`.
10. **Create `apps/mobile`** — move `android/`, recreate `capacitor.config.ts` at `apps/mobile/`, set `webDir: '../web/dist'`. Verify a debug Android build still works.
11. **Update root `package.json`** — keep only Nx + biome + workspace tools, point all scripts at `nx run-many` / `nx affected`. Add `engines` field.
12. **Wire CI** — add `.github/workflows/ci.yml`, Nx Cloud access token, confirm `nx affected` works on a test PR.
13. **Clean up** — delete `src/`, `backend/`, `functions/`, `android/`, old root configs once everything is validated by a full `nx run-many -t build test lint`.
14. **Documentation** — update `README.md` with the new layout, dev commands, and how to add a new lib/app.

## Risks and mitigations

- **Risk:** pnpm vs npm tooling change. **Mitigation:** commit `pnpm-lock.yaml`, pin pnpm via `packageManager` field, document in README.
- **Risk:** Boundaries block legitimate imports. **Mitigation:** rules are explicit, exceptions go through tags; first PR can be adjusted before the boundary rule is enforced in CI.
- **Risk:** Capacitor `webDir` breaks Android build. **Mitigation:** step 10 verifies a debug Android build before deleting the old `android/` location.
- **Risk:** Single big PR is hard to review. **Mitigation:** commit series is logically ordered (config → types/util → data-access → ui → feature → apps → cleanup) so reviewers can step through.
- **Risk:** Vitest workspaces with new globs miss tests. **Mitigation:** step 8/9 run full `nx test` and confirm coverage matches pre-migration.

## Out of scope

- Migrating off Cloudflare (Workers/Pages) — both stay.
- Replacing biome with eslint (biome stays for general lint+format).
- Replacing Capacitor with React Native or another mobile stack.
- Migrating to Turborepo, Rush, Lerna, or any other monorepo tool.
- Setting up Storybook (can be added later as a `libs/storybook` config lib).
- Migrating tests from Vitest to Jest, or from Playwright to Cypress.

## References

- Nx docs: https://nx.dev
- pnpm workspaces: https://pnpm.io/workspaces
- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/
- `@nx/enforce-module-boundaries`: https://nx.dev/nx-api/eslint-plugin#enforce-module-boundaries
