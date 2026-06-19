# Renovate Configuration Design

**Date:** 2026-06-17
**Status:** Approved (pending user review of this document)
**Scope:** Replace PR #21's onboarding stub with a production `renovate.json` that keeps dependencies current with minimal review burden, while making every major-version bump a deliberate event.

## Context

PR #21 (`renovate/configure`) is open with a 6-line `renovate.json` containing only `$schema` and `extends: ["config:recommended"]`. Merging it as-is would open ~49 PRs in the first run, including majors for `react` 18→19, `vite` 5→8, `typescript` 5→6, `nx` 19→23, `pnpm` 9→11, `gradle` 8→9, `capacitor` 7→8, plus a security advisory for `vitest` 2→3.

A previous Dependabot configuration spec (commit 5dcdc9d) was authored and immediately reverted (commit 5a0fe30). The revert is intentional: Dependabot is abandoned in favor of Renovate.

This spec replaces PR #21's stub with a configuration that groups and schedules updates to match the monorepo's reality.

**Correction history.** An earlier draft of this spec assumed `platformAutomerge: true` would auto-land safe updates after `ci` is green. That assumption requires branch protection with required status checks, which is unavailable on GitHub Free for private repos. This revision drops `platformAutomerge` and all per-rule `automerge: true` flags; every Renovate PR is reviewed and merged manually. Two earlier fields were also removed or renamed based on the Renovate schema validator: `commitBody: true` (schema requires a string, not a boolean) and `requiredStatusChecks: ["ci"]` (deprecated; gate is enforced at the GitHub workflow level instead). `baseBranches` was renamed to `baseBranchPatterns` (deprecated name). `appliesTo` was renamed to `matchPackageNames` (not a valid Renovate field).

## Goals

1. Keep dependencies current (security + feature) with low manual review burden.
2. Avoid a 49-PR flood on first activation.
3. Make every major-version bump a deliberate, reviewable event.
4. Batch patch and minor updates into compact, reviewable PRs that the maintainer merges after `ci` is green.
5. Preserve the current monorepo invariants: pnpm workspace, Nx project graph, lockfile stability.

## Non-goals

- Re-enabling or running Dependabot in parallel.
- Modifying CI workflows or Nx configuration.
- Touching the in-flight Nx migration (`nx-migration` branch).
- Auto-merging changes to `package.json` fields other than `dependencies`, `devDependencies`, `peerDependencies`, and `pnpm.overrides`.

## Configuration shape

One file: `renovate.json` at the repo root. No `renovate/` directory, no shared presets, no additional config files. Future tuning lives in this file.

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "baseBranchPatterns": ["main"],
  "branchPrefix": "renovate/",
  "schedule": ["before 4am on wednesday"],
  "timezone": "Europe/Istanbul",
  "prHourlyLimit": 2,
  "prConcurrentLimit": 10,
  "enabledManagers": ["npm", "github-actions", "gradle", "gradle-wrapper"],
  "ignorePaths": [
    "**/dist/**",
    "**/coverage/**",
    "**/.nx/cache/**",
    "**/node_modules/**"
  ],
  "packageRules": [
    {
      "description": "Weekly minor/patch bundle for non-monorepo npm packages.",
      "groupName": "weekly-minor-bundle",
      "matchPackageNames": [
        "@types/node",
        "pocketbase",
        "msw",
        "wrangler",
        "react-leaflet",
        "react-day-picker",
        "react-resizable-panels",
        "recharts",
        "vite-plugin-qrcode",
        "@cloudflare/workers-types",
        "@cloudflare/vitest-pool-workers",
        "@vitejs/plugin-react",
        "vitest",
        "typescript",
        "vite",
        "pnpm"
      ],
      "matchUpdateTypes": ["minor", "patch"]
    },
    {
      "description": "All major-version updates are manual, drafted, and require dashboard approval.",
      "matchUpdateTypes": ["major"],
      "dependencyDashboardApproval": true,
      "labels": ["major", "breaking"],
      "reviewers": ["@isrky"]
    },
    {
      "description": "GitHub Actions: batch patch and minor updates together; manual review.",
      "matchManagers": ["github-actions"],
      "matchUpdateTypes": ["minor", "patch"]
    },
    {
      "description": "Gradle and Android tools: batch patch and minor updates together; manual review.",
      "matchManagers": ["gradle", "gradle-wrapper"],
      "matchUpdateTypes": ["minor", "patch"]
    }
  ]
}
```

## Grouping strategy

Three layers, applied in priority order (later rules win).

**Layer 1 — Monorepo preset (inherited from `config:recommended`).**
Renovate auto-detects and groups `nx`, `radix-ui-primitives`, `capacitor`, `tanstack-virtual`, `typescript-eslint`, `eslint`, `material-ui`, `lucide`, `react`, `react-router` into one PR each. These PRs are batched for manual review on `patch` and `minor` updates.

**Layer 2 — `weekly-minor-bundle` (custom package rule).**
Bundles every non-major npm update that is not in a monorepo group into a single PR. Auto-merges on green CI. Runs only when at least one matched package actually moved that week; no empty PRs.

**Layer 3 — Major-version separation (custom package rule).**
Each major-version bump becomes its own PR. Opens as a draft, labels `major` and `breaking`, assigns `@isrky`, requires explicit approval from the Dependency Dashboard before merge.

## Auto-merge matrix

| Update type | Non-monorepo npm | Monorepo preset PRs | Major | Security advisory |
|---|---|---|---|---|
| patch | auto | auto | n/a | auto |
| minor | manual (bundle) | manual (per-preset PR) | n/a | manual |
| major | manual | manual | manual | manual |
| GitHub Actions patch/minor | manual | n/a | manual | manual |
| Gradle / AGP patch/minor | manual | n/a | manual | manual |

The `matchUpdateTypes: ["major"]` rule is evaluated before the security-advisory path: even when GitHub publishes a security advisory that is also a major bump, the PR is treated as a major (manual, drafted, dashboard approval required).

## Schedule

`schedule: ["before 4am on wednesday"]` with `timezone: "Europe/Istanbul"`. Renovate treats the schedule as a work window: it batches, opens PRs, and waits. The maintainer reviews and merges PRs after CI is green.

**Weekly flow:**

1. **Tuesday night → Wednesday 04:00 (Istanbul):** Renovate scans, opens grouped PRs, regenerates lockfiles.
2. **Wednesday 04:00 → midday:** CI runs on each PR; the maintainer reviews and merges PRs as `ci` goes green.
3. **Wednesday midday → end of week:** Major-version PRs sit in review; dashboard lists them.
4. **Out-of-band:** Vulnerability alerts bypass the schedule and land as soon as GitHub publishes an advisory.

## Lockfile handling

Per-PR regeneration. Each grouped PR is one `pnpm install` that re-locks; no separate `lockfileMaintenance` block. pnpm's lockfile is deterministic and the workspace is small enough that regeneration cost is negligible. If lockfile-merge-conflict pain emerges, the response is to switch to per-package PRs for the affected dep, not to add a separate maintenance schedule.

## Vulnerability alerts

`vulnerabilityAlerts: true` (default with `config:recommended`). A GitHub Advisory trigger opens a security PR regardless of schedule.

- One package per PR (no grouping, so the fix is auditable).
- Auto-merge on green CI.
- Branch prefix: `renovate/security-…`.
- Subject to the major-version rule above: a security advisory that is also a major bump is treated as a major (manual, drafted, dashboard approval required).

## CI integration

The `ci` job in `.github/workflows/ci.yml` is the only gate. It runs `pnpm install --frozen-lockfile` and `nx affected -t lint type-check test build`, then conditionally E2E and deploy on `push` to `main`.

**Auto-merge path:**

1. Renovate opens PR with labels (`renovate`).
2. `ci` runs and reports success.
3. The maintainer reviews and merges the PR via the GitHub UI (or `gh pr merge`).
4. Squash-merged into `main`, branch auto-deleted.

**Manual-merge path (majors):**

1. PR opens as draft with labels `major`, `breaking`, reviewer `@isrky`.
2. `dependencyDashboardApproval: true` — the PR's "approve" checkbox on the dashboard is the only merge path from the dashboard view. Direct merge from the PR page also works.
3. Reviewer reviews, runs any extra local validation, merges.

**Prerequisite:** none. Renovate opens PRs; the maintainer merges them after `ci` is green. Branch protection is not required because Renovate never auto-merges.

## Activation

Three ordered steps:

1. **Land `renovate.json` via a PR that closes PR #21.** New branch `chore/renovate-config`. PR description: "Configures Renovate with grouped monorepo updates, weekly Wednesday schedule, manual review for all updates including patches and minors. Closes #21."
2. **First-run observation window** — the Wednesday after the config lands, watch the Dependency Dashboard. Expected: 3–6 non-major PRs across monorepo groups plus the weekly-minor-bundle. Review and merge each PR after `ci` is green; manually merge the queued vitest-v3 security major to confirm the major rule applies even to security advisories.

## Rollback

Three levels, any one of which fully stops Renovate:

1. **Soft:** close the Dependency Dashboard issue → Renovate pauses.
2. **Medium:** delete `renovate.json` in a PR → Renovate falls back to default config (no grouping, no automerge, all majors flood in). Use only as a temporary state.
3. **Hard:** Settings → Code security and analysis → disable the Renovate GitHub App. Stops all runs.

## Testing & verification

**Static validation.** A `pnpm run renovate:validate` script invokes `renovate-config-validator` (run via `npx --yes --package=renovate -- renovate-config-validator`) and is wired into the existing `pnpm run check` chain. Catches typos before they reach `main`.

**Acceptance criteria** (this is what "done" means):

1. `renovate.json` exists at repo root, validates against the schema, and contains all the configuration decisions in this spec.
2. PR #21 is closed (in favor of the new config PR).
3. First Wednesday after activation: the Dependency Dashboard lists expected PRs (3–6 non-major PRs across monorepo groups plus the weekly-minor-bundle).
4. First Wednesday after activation: the queued vitest-v3 PR opens as a manually-merged PR (not auto-merged), confirming the major rule beats the security-advisory path.
5. `pnpm run renovate:validate` exits 0.

## Risks

1. **vitest v3 security major in week 1.** The queued advisory is a major-version bump. The PR is treated as a major (manual, drafted, dashboard approval required), even though it's a security advisory. The PR description includes the advisory link, labels include `security`, and the dashboard highlights it. The maintainer merges after review.
2. **pnpm-lock.yaml conflicts in the weekly bundle.** Multiple grouped PRs opening Wednesday could race on lockfile updates. Renovate handles this with `rebaseWhen: "behind-base-branch"` (default). If a rebase fails, the PR is closed and reopened. Expected cost: 1–2 PRs per week may need a manual rebase.
3. **React 19 / TypeScript 6 / Vite 8 majors.** When these unblock, each is its own PR with reviewer `@isrky` and the `breaking` label. Reviewing 4–6 such PRs is the cost of staying current.
4. **Gradle / AGP majors can break the Android build.** AGP 8→9 and Gradle 8→9 are queued. All PRs are manual; broken builds are visible in CI before merge.
5. **Renovate's `config:recommended` evolves.** Mend changes preset behavior between Renovate versions. If a future preset change affects grouping or schedule interpretation, the response is to set explicit overrides on the sub-options we depend on. Defer until a behavior change is observed.
6. **Nx-migration branch conflict.** The `nx-migration` branch is in `ci.yml`'s trigger list. Renovate's `baseBranchPatterns: ["main"]` keeps it off the migration branch, so no conflict. If the migration merges to `main` while a Renovate PR is open, the PR will need to rebase — normal git flow.

## Out of scope

- Dependabot version updates must remain disabled.
- Renovate's `docker` and `gomod` managers are not enabled (no Dockerfile or Go code in this repo).
- A `renovate/` directory or shared preset repo (defer until second repo onboards).

## Open questions (non-blocking)

- Should `tools/` be excluded from Renovate until Nx generators stabilize? Lean: include and observe.
- Should we add `prBodyNotes` to remind reviewers of breaking-change etiquette for majors? Lean: yes, one-liner.
- Long-term: graduate to `renovate/` directory and shared presets when a second repo onboards.
