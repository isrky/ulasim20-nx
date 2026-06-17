# Renovate Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PR #21's stub `renovate.json` with a production Renovate configuration that keeps dependencies current with low review burden, gates majors for manual review, and auto-lands patches/minors/security fixes on green CI.

**Architecture:** A single `renovate.json` at the repo root extends `config:recommended` and adds four custom `packageRules` (weekly-minor-bundle, majors, GitHub Actions, Gradle). Validation runs through `renovate-config-validator` via a `pnpm run renovate:validate` script that uses `npx` (no `renovate` devDependency — keep the lockfile lean). A one-time branch-protection step on `main` is the only manual prerequisite for auto-merge.

**Tech Stack:** Renovate (Mend-hosted), `renovate-config-validator` (CLI), pnpm scripts, GitHub branch protection.

**Spec:** `docs/superpowers/specs/2026-06-17-renovate-configuration-design.md`

---

## File Structure

### New
- `renovate.json` — production Renovate config (replaces PR #21's stub).

### Modified
- `package.json` — add `renovate:validate` script and include it in the `check` chain.

### Unchanged
- `.github/workflows/ci.yml` — already runs `lint`, `type-check`, `test`, `build`; no changes.
- `pnpm-lock.yaml` — not modified (we use `npx --yes`, not a local install).

---

## Task 1: Add the `renovate:validate` script

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Verify the validator works in isolation**

Run from the repo root:
```bash
npx --yes --package renovate -- renovate-config-validator
```

Expected: exits 0 and prints something like `INFO: Config validated successfully` even though no `renovate.json` exists yet (default behavior: skips when no file found, exits 0). This confirms `npx` and network access work; we can proceed.

If the command fails with a non-zero exit code due to a missing file, that's still fine for now — it confirms the tool runs. The important thing is no syntax/network error.

- [ ] **Step 2: Edit `package.json` to add the `renovate:validate` script**

Open `package.json` and add the script in the `scripts` block (alphabetical with the other `r*` entries; insert after `planner:promote` since `r` comes after `p`):

```json
"scripts": {
  "dev": "pnpm exec nx serve web",
  "dev:backend": "pnpm exec nx serve backend",
  "build": "pnpm exec nx run-many -t build",
  "build:web": "pnpm exec nx build web",
  "build:backend": "pnpm exec nx build backend",
  "test": "pnpm exec nx run-many -t test",
  "test:web": "pnpm exec nx test web",
  "test:backend": "pnpm exec nx test backend",
  "test:e2e": "playwright test",
  "typecheck": "pnpm exec nx run-many -t type-check",
  "lint": "pnpm exec nx run-many -t lint",
  "lint:fix": "biome lint --write . && pnpm exec nx run-many -t lint -- --fix",
  "format": "biome format .",
  "format:fix": "biome format --write .",
  "check": "pnpm exec nx run-many -t lint type-check",
  "check:fix": "pnpm exec nx run-many -t lint -- --write --fix && pnpm exec nx run-many -t lint -- --fix",
  "planner:fetch": "pnpm exec nx run backend:planner:fetch-normalize",
  "planner:signature": "pnpm exec nx run backend:planner:compute-source-signature",
  "planner:compile": "pnpm exec nx run backend:planner:compile-dataset",
  "planner:validate": "pnpm exec nx run backend:planner:validate-dataset",
  "planner:promote": "pnpm exec nx run backend:planner:promote-manifest",
  "renovate:validate": "npx --yes --package renovate -- renovate-config-validator"
}
```

Also update the `check` script to include `renovate:validate` so it's enforced in CI:

Change:
```json
"check": "pnpm exec nx run-many -t lint type-check",
```

To:
```json
"check": "pnpm exec nx run-many -t lint type-check && pnpm run renovate:validate",
```

- [ ] **Step 3: Verify the script is wired**

Run: `pnpm run renovate:validate`
Expected: exits 0 (no `renovate.json` yet, so the validator either succeeds with "no config files found" or runs successfully).

- [ ] **Step 4: Create the working branch**

```bash
git checkout -b chore/renovate-config
```

All subsequent commits in this plan land on this branch.

- [ ] **Step 5: Commit**

```bash
git add package.json
git -c user.email=isrky@users.noreply.github.com -c user.name="Ismail Sarikaya" commit -m "chore: add renovate:validate script and wire into check"
```

---

## Task 2: Add minimal `renovate.json` (schema + extends only)

**Files:**
- Create: `renovate.json`

- [ ] **Step 1: Write the minimal config**

Create `renovate.json` at the repo root with the exact contents:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"]
}
```

- [ ] **Step 2: Run the validator**

Run: `pnpm run renovate:validate`
Expected: prints `INFO: Validating renovate.json` and `INFO: Config validated successfully`, exits 0.

- [ ] **Step 3: Commit**

```bash
git add renovate.json
git -c user.email=isrky@users.noreply.github.com -c user.name="Ismail Sarikaya" commit -m "chore(renovate): add minimal config (schema + config:recommended)"
```

---

## Task 3: Add scheduling, automerge, and global flags

**Files:**
- Modify: `renovate.json`

- [ ] **Step 1: Replace the contents of `renovate.json`**

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
  "platformAutomerge": true,
  "automergeStrategy": "squash",
  "automergeType": "pr"
}
```

- [ ] **Step 2: Run the validator**

Run: `pnpm run renovate:validate`
Expected: exits 0 with `INFO: Config validated successfully`.

- [ ] **Step 3: Commit**

```bash
git add renovate.json
git -c user.email=isrky@users.noreply.github.com -c user.name="Ismail Sarikaya" commit -m "chore(renovate): add schedule, automerge, and global flags"
```

---

## Task 4: Add the `weekly-minor-bundle` package rule

**Files:**
- Modify: `renovate.json`

- [ ] **Step 1: Add `packageRules` with the weekly-minor-bundle**

Insert a `packageRules` array at the bottom of `renovate.json` (the file already has top-level fields; `packageRules` is the only nested object). The new content of `renovate.json`:

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
  "platformAutomerge": true,
  "automergeStrategy": "squash",
  "automergeType": "pr",
  "packageRules": [
    {
      "description": "Weekly minor/patch bundle for non-monorepo npm packages; auto-merges on green CI.",
      "groupName": "weekly-minor-bundle",
      "appliesTo": [
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
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true
    }
  ]
}
```

- [ ] **Step 2: Run the validator**

Run: `pnpm run renovate:validate`
Expected: exits 0 with `INFO: Config validated successfully`.

- [ ] **Step 3: Commit**

```bash
git add renovate.json
git -c user.email=isrky@users.noreply.github.com -c user.name="Ismail Sarikaya" commit -m "chore(renovate): add weekly-minor-bundle package rule"
```

---

## Task 5: Add the major-version separation rule

**Files:**
- Modify: `renovate.json`

- [ ] **Step 1: Append the major rule to `packageRules`**

Insert a new entry after the `weekly-minor-bundle` rule (still inside the `packageRules` array, before the closing `]`). The `packageRules` array becomes:

```json
"packageRules": [
  {
    "description": "Weekly minor/patch bundle for non-monorepo npm packages; auto-merges on green CI.",
    "groupName": "weekly-minor-bundle",
    "appliesTo": [
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
    "matchUpdateTypes": ["minor", "patch"],
    "automerge": true
  },
  {
    "description": "All major-version updates are manual, drafted, and require dashboard approval.",
    "matchUpdateTypes": ["major"],
    "automerge": false,
    "dependencyDashboardApproval": true,
    "labels": ["major", "breaking"],
    "reviewers": ["@isrky"]
  }
]
```

- [ ] **Step 2: Run the validator**

Run: `pnpm run renovate:validate`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add renovate.json
git -c user.email=isrky@users.noreply.github.com -c user.name="Ismail Sarikaya" commit -m "chore(renovate): add major-version separation rule"
```

---

## Task 6: Add the GitHub Actions manager rule

**Files:**
- Modify: `renovate.json`

- [ ] **Step 1: Append the github-actions rule to `packageRules`**

Insert a new entry at the end of the `packageRules` array (after the major rule, before `]`):

```json
{
  "description": "GitHub Actions: auto-merge on patch and minor; majors remain manual.",
  "matchManagers": ["github-actions"],
  "matchUpdateTypes": ["minor", "patch"],
  "automerge": true
}
```

- [ ] **Step 2: Run the validator**

Run: `pnpm run renovate:validate`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add renovate.json
git -c user.email=isrky@users.noreply.github.com -c user.name="Ismail Sarikaya" commit -m "chore(renovate): add GitHub Actions auto-merge rule"
```

---

## Task 7: Add the Gradle manager rule

**Files:**
- Modify: `renovate.json`

- [ ] **Step 1: Append the gradle rule to `packageRules`**

Insert a new entry at the end of the `packageRules` array (after the github-actions rule, before `]`):

```json
{
  "description": "Gradle and Android tools: auto-merge on patch and minor; majors remain manual.",
  "matchManagers": ["gradle", "gradle-wrapper"],
  "matchUpdateTypes": ["minor", "patch"],
  "automerge": true
}
```

- [ ] **Step 2: Run the validator one more time**

Run: `pnpm run renovate:validate`
Expected: exits 0 with `INFO: Config validated successfully`. The `packageRules` array should now have four entries.

- [ ] **Step 3: Verify the final `renovate.json` matches the spec**

Run: `cat renovate.json`
Expected: matches the JSON block in §"Configuration shape" of `docs/superpowers/specs/2026-06-17-renovate-configuration-design.md` (the `packageRules` array has all four rules in order: weekly-minor-bundle, major, github-actions, gradle).

- [ ] **Step 4: Run the full `check` script to confirm CI will pass**

Run: `pnpm run check`
Expected: `lint` and `type-check` complete without errors, then `renovate:validate` prints `INFO: Config validated successfully` and exits 0.

- [ ] **Step 5: Commit**

```bash
git add renovate.json
git -c user.email=isrky@users.noreply.github.com -c user.name="Ismail Sarikaya" commit -m "chore(renovate): add Gradle auto-merge rule (final config)"
```

---

## Task 8: Open the activation PR that closes PR #21

**Files:**
- Modify: branch only (no file changes — all changes already committed on `chore/renovate-config`)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin chore/renovate-config
```

- [ ] **Step 2: Open the PR with `gh`**

```bash
gh pr create \
  --base main \
  --head chore/renovate-config \
  --title "chore(renovate): production configuration (closes #21)" \
  --body "Configures Renovate with grouped monorepo updates, weekly Wednesday 04:00 Istanbul schedule, automerge for patch/minor/security, manual review for majors. Closes #21."
```

Expected: PR opens against `main`. CI runs `lint`, `type-check`, `test`, `build` and the new `renovate:validate` step — all should pass.

- [ ] **Step 3: Confirm the PR is open**

Run: `gh pr list --head chore/renovate-config`
Expected: one open PR.

---

## Task 9: Manual prerequisite — enable branch protection on `main`

This is a one-time repo setting, not a code change. It must be done before any Renovate PR can auto-merge.

- [ ] **Step 1: Navigate to branch protection settings**

Open `https://github.com/isrky/ulasim20-nx/settings/branches` (or the equivalent URL for this repo's `main` branch protection rules).

- [ ] **Step 2: Add `ci` as a required status check**

In the `main` branch protection rule:
- Enable "Require status checks to pass before merging".
- In the status checks list, search for and select `ci` (the only job in `.github/workflows/ci.yml`).
- Save the rule.

- [ ] **Step 3: Verify the rule is active**

Open the activation PR from Task 8. The branch protection check should now show as required in the PR's merge box. (No merge action — just confirm the rule is visible.)

---

## Task 10: Verify acceptance criteria from the spec

**Spec reference:** `docs/superpowers/specs/2026-06-17-renovate-configuration-design.md` §"Acceptance criteria".

- [ ] **AC1 — `renovate.json` exists, validates, and contains all decisions**

Run: `pnpm run renovate:validate`
Expected: exits 0. Run: `cat renovate.json` and compare against the spec's `Configuration shape` section.

- [ ] **AC2 — PR #21 is closed in favor of the new config PR**

Run: `gh pr view 21 --json state`
Expected: `"state": "CLOSED"`. (Closing happens when the activation PR from Task 8 is merged, or when you close #21 manually with a comment referencing the new PR.)

- [ ] **AC3 — Branch protection on `main` requires `ci`**

This is a manual verification — confirm the rule is in place via the GitHub UI (no CLI to read this directly).

- [ ] **AC4 — First Wednesday observation (deferred)**

The first non-major auto-merge is observed on the Wednesday after this PR lands. Confirm via the Dependency Dashboard and merged-PR history. **This criterion cannot be satisfied during the implementation session; it is a downstream verification.**

- [ ] **AC5 — vitest-v3 PR opens as manual-merge (deferred)**

The queued vitest-v3 security major PR (from PR #21's onboarding summary) should open as a **manual-merge** PR after config lands, confirming the major rule beats the security-advisory path. **Deferred to first Wednesday observation.**

- [ ] **AC6 — `pnpm run renovate:validate` exits 0**

Run: `pnpm run renovate:validate`
Expected: exits 0.

---

## Definition of Done

- All nine tasks checked.
- `renovate.json` exists at the repo root, validates, and matches the spec.
- `pnpm run renovate:validate` exits 0; `pnpm run check` exits 0.
- The activation PR is open against `main` and CI is green.
- Branch protection on `main` lists `ci` as a required status check.
- AC1, AC2, AC3, AC6 are satisfied in-session; AC4 and AC5 are deferred to the first Wednesday observation.
