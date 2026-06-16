# Dependabot Configuration — Design

**Date:** 2026-06-16
**Status:** Approved (pending user review of written spec)
**Scope:** Configure Dependabot for the Ulasim20 Nx monorepo. The 61 existing
vulnerabilities reported by `pnpm audit` are intentionally not fixed in this
change; they will surface as the first batch of Dependabot PRs.

## Goals

1. Make dependency updates visible and reviewable on a predictable cadence.
2. Surface new security advisories as separate, time-bounded PRs.
3. Avoid blanket auto-merge — humans review every PR against the existing CI.
4. Cover every workspace package so no direct dependency is missed.
5. Generate grouped PRs so a single weekly PR per package ecosystem can batch
   many minor updates together.

## Non-goals (explicit out of scope)

- Fixing the 61 existing audit findings directly.
- Adding a `pnpm audit` step to CI.
- Adding a `CODEOWNERS` file or per-package review routing.
- Auto-merge workflows (GitHub Actions or repository rulesets).
- Switching to Renovate or any non-Dependabot alternative.
- Upgrading the major version of any dependency as part of this change.

## Constraints / Context

- Repo is an Nx monorepo managed with pnpm 9 (`packageManager: pnpm@9.12.0`).
- `pnpm-workspace.yaml` declares `apps/**`, `libs/**`, `tests/**`.
- 36 workspace packages have a `package.json`:
  - 1 root
  - 3 apps (`apps/web`, `apps/backend`, `apps/mobile`)
  - 32 libs across `libs/config/*` (5), `libs/data-access/*` (5),
    `libs/feature/*` (6), `libs/types/*` (3), `libs/ui/*` (6),
    `libs/util/*` (7)
- The `tests/` workspace contains Playwright/E2E and Vitest setup but no
  first-party `package.json` requiring separate coverage (it is covered
  transitively by the apps and libs that depend on it). We will not add an
  entry for it.
- The existing `.github/workflows/ci.yml` already runs on
  `pull_request` against `main` and `nx-migration`, so Dependabot PRs will
  trigger CI automatically with no workflow changes.
- `package.json` direct deps include both `dev` and `runtime` (prod) entries,
  which motivates splitting groups per dependency-type.

## Approach

Add a single file: **`.github/dependabot.yml`**.

It contains 36 ecosystem entries — one per workspace `package.json`. This is
the minimum granularity that matches `pnpm-workspace.yaml` discovery, so no
direct dependency in any package is missed.

Each entry:

```yaml
- package-ecosystem: "npm"
  directory: "<path-to-package>"
  schedule:
    interval: "weekly"
    day: "wednesday"
    time: "04:00"
    timezone: "Europe/Istanbul"
  open-pull-requests-limit: 5
  groups:
    dev-dependencies:
      dependency-type: "development"
    prod-dependencies:
      dependency-type: "production"
  labels:
    - "dependencies"
    - "automated-pr"
  ignore:
    dependency-name:
      - "@ulasim20/*"
```

Globally (at file top):

```yaml
version: 2
enable-beta-ecosystems: false
```

Notes:

- `package-ecosystem: "npm"` is correct for pnpm — Dependabot reads
  `pnpm-lock.yaml` using the npm ecosystem.
- The `wednesday 04:00 Europe/Istanbul` schedule is the agreed cadence.
- The two `groups` (dev vs. prod) keep production dependency updates
  reviewable independently from dev-tooling churn.
- Ignoring `@ulasim20/*` prevents Dependabot from proposing updates to
  in-repo workspace packages, which are managed by Nx generators.
- Labels are created automatically by GitHub the first time Dependabot
  applies them.

### Security updates

`security-updates: enabled` is the v2 default in Dependabot; it is also
explicitly added at the file level for clarity. Combined with the weekly
grouped schedule, this means:

- New security advisories produce a dedicated
  "Dependabot security update" PR, opened within minutes of the advisory.
- Weekly version-update PRs continue to batch normal updates.
- A security update for a production dependency will not be hidden inside
  a dev-only group, because the dev/prod split is preserved per entry.

## Directory coverage (31 entries)

- `/`
- `/apps/web`
- `/apps/backend`
- `/apps/mobile`
- `/libs/config/biome`
- `/libs/config/eslint`
- `/libs/config/tailwind`
- `/libs/config/tsconfig`
- `/libs/config/vite`
- `/libs/data-access/api-client`
- `/libs/data-access/capacitor`
- `/libs/data-access/mock-data`
- `/libs/data-access/msw-handlers`
- `/libs/data-access/transport-api`
- `/libs/feature/auth`
- `/libs/feature/card`
- `/libs/feature/notifications`
- `/libs/feature/planner`
- `/libs/feature/routes`
- `/libs/feature/vehicles`
- `/libs/types/api`
- `/libs/types/env`
- `/libs/types/transport`
- `/libs/ui/icons`
- `/libs/ui/layout`
- `/libs/ui/map`
- `/libs/ui/page-shell`
- `/libs/ui/primitives`
- `/libs/ui/theme`
- `/libs/util/analytics`
- `/libs/util/date`
- `/libs/util/format`
- `/libs/util/geo`
- `/libs/util/hooks`
- `/libs/util/search`
- `/libs/util/validation`

(Counted: 1 root + 3 apps + 32 libs = 36 entries.)

## PR handling

- No auto-merge. Dependabot PRs require human review and merge.
- Existing CI (`.github/workflows/ci.yml`) already runs on pull_request to
  `main` and `nx-migration`, so no workflow change is needed.
- The first run is expected to produce roughly one PR per package ecosystem
  (up to the `open-pull-requests-limit: 5` cap), most of which will touch
  the existing audit findings. This is intentional: it converts the current
  invisible backlog into a visible, reviewable work queue.
- We do **not** add `CODEOWNERS` in this change. Per-package review routing
  is a future improvement, gated on having actual reviewers assigned.

## Labels & commit conventions

- Labels: `dependencies`, `automated-pr`. Both will be created automatically
  by GitHub on the first PR that uses them.
- Commit messages use Dependabot defaults (`chore(deps):` / `chore(deps-dev):`),
  which match the repo's biome formatting expectations. The repo does not
  enforce commitlint, so no custom prefix is needed.

## Ignores (to keep noise down)

- All `@ulasim20/*` workspace packages are ignored.
- No major-version-bump ignores are added in this change. If particular
  packages (e.g. `nx`, `@nx/*`, `@cloudflare/workers-types`, `wrangler`,
  `vitest`, `react`, `react-dom`) turn out to be too noisy in practice,
  we will add ignores after the first weekly cycle. This is YAGNI for now.

## Testing / verification

After this change is merged:

1. Open the Dependabot dashboard on the repository and confirm all 36
   ecosystem entries are listed and enabled.
2. Trigger an initial run via the "Check for updates" button in the
   Dependabot dashboard to surface the first batch of PRs without
   waiting for the scheduled Wednesday 04:00 run.
3. Verify the first PR set is consistent with this design:
   - Up to 5 open PRs per package ecosystem.
   - Each package's PR touches only that package's `package.json` plus
     `pnpm-lock.yaml` (since pnpm updates the single root lockfile).
   - PRs are labeled `dependencies` and `automated-pr`.
   - Security advisories produce separate "security update" PRs, not
     mixed into the weekly groups.
4. CI (`.github/workflows/ci.yml`) must pass on the first PR before any
   merge. If CI fails on a Dependabot PR, treat the failure the same way
   as any other PR — investigate, fix, re-run.
5. Spot-check that no `@ulasim20/*` updates are proposed.

## Risks

- **Lockfile thrash on first run:** pnpm stores a single root
  `pnpm-lock.yaml`, so any weekly PR that touches a direct dep will
  regenerate the full lockfile. This is expected; the existing CI runs
  `pnpm install --frozen-lockfile`, which is exactly what we want to
  validate that the regenerated lockfile is internally consistent.
- **Duplicate PRs across packages:** Because pnpm hoists shared
  transitive deps, a single transitive update can show up in multiple
  package ecosystems. The per-package grouping is intentional — we want
  the PR scoped to the package whose direct deps triggered the update,
  not a global "all packages" PR.
- **No auto-merge means manual workload:** A small repo with many transitive
  vulns will see a burst of PRs in the first week. The user accepted
  this trade-off explicitly in the brainstorming questions.

## Migration / rollout

This is a one-commit change adding a single file. No migration steps.
After merge, the very first scheduled run (next Wednesday 04:00
Europe/Istanbul) will produce the first batch of PRs; a manual
"Check for updates" trigger can be used to start the flow sooner.

## Open questions

None at spec time. All clarifying questions were resolved during
brainstorming:

- Primary goal: Set up Dependabot only (existing vulns become PRs).
- Auto-merge: none.
- Cadence: weekly, grouped, Wednesday 04:00 Europe/Istanbul.
- Scope: root + `apps/*` + `libs/*` (per-package).
- Security updates: enabled.
