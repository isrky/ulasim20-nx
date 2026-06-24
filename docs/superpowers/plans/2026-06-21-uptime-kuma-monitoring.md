# Uptime Kuma Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Uptime Kuma (external, self-hosted) to monitor this project's deployed URLs by adding a `/health` endpoint to the Hono backend and a `monitoring/README.md` that lists every monitor an operator should create.

**Architecture:** A pure 200 + JSON `GET /health` route is added to the existing Hono app in `apps/backend/src/index.ts`, alongside (not replacing) the existing `/`, `/api`, `/api/` health-style endpoints. A new repo-root `monitoring/README.md` documents the production and preview monitor list as the single source of truth for Kuma configuration.

**Tech Stack:** Hono 4, Cloudflare Workers, `@cloudflare/vitest-pool-workers`, Vitest 2, TypeScript 5.

---

## File Structure

This change touches three files:

| File | Responsibility | Type |
| --- | --- | --- |
| `apps/backend/src/index.ts` | Define the new `app.get('/health', ...)` route. | Modify (add one line block). |
| `apps/backend/src/app.test.ts` | Add a Vitest case asserting `GET /health` returns 200 + `{ status: 'ok' }`. | Modify (add one `it` to an existing `describe`). |
| `monitoring/README.md` | Human-readable source of truth for the Uptime Kuma monitor list. | Create. |

No new files in `apps/backend/tests/` (existing tests live in `apps/backend/src/*.test.ts`, so the new test goes in `app.test.ts` next to its peers).

No changes to `wrangler.toml`, CI, env vars, or any frontend app.

---

## Task 1: Add the failing test for `GET /health`

**Files:**
- Modify: `apps/backend/src/app.test.ts:1-20` (append a new `it` to the `describe('Hono app — health', ...)` block)

- [ ] **Step 1: Add the failing test**

Open `apps/backend/src/app.test.ts`. Inside the existing `describe('Hono app — health', () => { ... })` block, add a new `it` as the third case (after the two existing ones, before the closing `})`):

```ts
  it('GET /health returns { status: "ok" }', async () => {
    const res = await SELF.fetch('http://localhost/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('ok')
  })
```

The final file should look like:

```ts
import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('Hono app — health', () => {
  it('GET / returns the healthy envelope', async () => {
    const res = await SELF.fetch('http://localhost/')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.service).toBe('ulasim-backend')
    expect(body.status).toBe('healthy')
    expect(typeof body.timestamp).toBe('string')
  })

  it('GET /api returns the healthy envelope', async () => {
    const res = await SELF.fetch('http://localhost/api')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.service).toBe('ulasim-backend')
  })

  it('GET /health returns { status: "ok" }', async () => {
    const res = await SELF.fetch('http://localhost/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('ok')
  })
})

describe('Hono app — CORS', () => {
  // ...unchanged
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
pnpm test:backend
```

Expected: the new test fails. The failure message should reference `/health` and a missing route / 404 (or a body-shape mismatch), e.g.:

```
Error: expected 200 to be 200
  expect(received).toBe(expected)
  ...
  at /workspace/apps/backend/src/app.test.ts:<line>
```

If the test errors (TypeError, import error, etc.) instead of failing cleanly, fix the test until it fails for the expected reason: the `/health` route does not exist yet.

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/backend/src/app.test.ts
git commit -m "test(backend): add failing test for GET /health"
```

---

## Task 2: Add the `GET /health` route

**Files:**
- Modify: `apps/backend/src/index.ts:60` (insert the new route between the `/api/` handler and the `// API Routes` comment block)

- [ ] **Step 1: Add the route**

Open `apps/backend/src/index.ts`. After the existing `app.get('/api/', ...)` block (which ends at line 60) and before the `// API Routes` comment, insert:

```ts
// Minimal health endpoint for Uptime Kuma (https://api.ulasim20.com/health).
// Returns 200 + { status: "ok" } with no I/O so it cannot cause a real incident.
app.get('/health', (c) => c.json({ status: 'ok' }))
```

The full top of the file should now read:

```ts
/**
 * Ulasim Backend - Hono Entry Point
 * Cloudflare Workers üzerinde çalışan API
 *
 * CPU Optimized for Free Tier (10ms limit)
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { feedbackRouter } from './routes/feedback'
import { pharmaciesRouter } from './routes/pharmacies'
import { plannerRouter } from './routes/planner'
import { routesRouter } from './routes/routes'
import { stationsRouter } from './routes/stations'
import type { Env } from './types'

// Create Hono app with Env type
const app = new Hono<{ Bindings: Env }>()

// Middleware - removed logger for CPU optimization
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
)

// Health check (root - for direct worker URL)
app.get('/', (c) => {
  return c.json({
    service: 'ulasim-backend',
    version: '2.0.0',
    status: 'healthy',
    optimizedFor: 'cloudflare-free-tier',
    timestamp: new Date().toISOString(),
  })
})

// Health check under /api (frontend checkBackendStatus() calls GET /api/)
app.get('/api', (c) => {
  return c.json({
    service: 'ulasim-backend',
    version: '2.0.0',
    status: 'healthy',
    optimizedFor: 'cloudflare-free-tier',
    timestamp: new Date().toISOString(),
  })
})
app.get('/api/', (c) => {
  return c.json({
    service: 'ulasim-backend',
    version: '2.0.0',
    status: 'healthy',
    optimizedFor: 'cloudflare-free-tier',
    timestamp: new Date().toISOString(),
  })
})

// Minimal health endpoint for Uptime Kuma (https://api.ulasim20.com/health).
// Returns 200 + { status: "ok" } with no I/O so it cannot cause a real incident.
app.get('/health', (c) => c.json({ status: 'ok' }))

// API Routes
app.route('/api/stations', stationsRouter)
// ...rest unchanged
```

- [ ] **Step 2: Run the backend tests**

Run:

```bash
pnpm test:backend
```

Expected: all tests pass, including the new `GET /health` test from Task 1 and the pre-existing cases.

- [ ] **Step 3: Run typecheck and lint for the backend**

Run:

```bash
pnpm exec nx run backend:type-check
pnpm exec nx run backend:lint
```

Expected: both pass with no new errors or warnings.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/index.ts
git commit -m "feat(backend): add GET /health endpoint for Uptime Kuma"
```

---

## Task 3: Add `monitoring/README.md`

**Files:**
- Create: `monitoring/README.md`

- [ ] **Step 1: Create the directory**

Run:

```bash
mkdir -p monitoring
```

- [ ] **Step 2: Write the README**

Create `monitoring/README.md` with the following exact content:

```markdown
# Uptime Kuma Monitoring

This document lists the URLs that Uptime Kuma should monitor for this project. Uptime Kuma is a self-hosted service that runs externally; this file is the source of truth for what it should be checking.

When you add, remove, or change a monitor in Kuma, update the matching row in the tables below in the same PR.

## Production monitors

| Name | URL | Type | Expected | Interval | Timeout | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Prod web (homepage) | `https://ulasim20.com/` | HTTP(s) | `200` | 60s | 5s | Custom domain (see `apps/web/public/sitemap.xml`). |
| Prod web (sitemap) | `https://ulasim20.com/sitemap.xml` | HTTP(s) | `200` | 60s | 5s | Sanity-checks that the SPA bundle is being served; a homepage 200 alone could be a CDN cache hit. |
| Prod backend health | `https://api.ulasim20.com/health` | HTTP(s) | `200`, body contains `"status":"ok"` | 60s | 5s | Custom domain from `apps/backend/wrangler.toml` routes. Returns `{ "status": "ok" }`. |

## Preview monitors (per-deploy)

Preview monitors are per-deploy: add one when a preview is created, remove it after the PR merges.

| Name | URL pattern | Type | Expected | Interval | Timeout | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Preview web | `https://<commit-sha>--ulasim20-pages.pages.dev/` | HTTP(s) | `200` | 60s | 5s | Cloudflare Pages preview URL. `<commit-sha>` is the short SHA from the deploy. |
| Preview backend health | `https://ulasim-backend.<account-subdomain>.workers.dev/health` | HTTP(s) | `200`, body contains `"status":"ok"` | 60s | 5s | Cloudflare Workers preview environment. `<account-subdomain>` is the per-account Workers subdomain (e.g. `<account>.workers.dev`). |

## How to add a new monitor

1. Find the deployed URL in the matching config:
   - Web production: `apps/web/public/sitemap.xml` and `apps/web/wrangler.toml`.
   - Backend production: `apps/backend/wrangler.toml` (`routes`).
   - Web preview: Cloudflare Pages deploy output for the PR (URL of the form `https://<commit-sha>--ulasim20-pages.pages.dev/`).
   - Backend preview: Cloudflare Workers preview URL of the form `https://ulasim-backend.<account-subdomain>.workers.dev/`.
2. In Kuma, create an `HTTP(s)` monitor with the values from the matching row above.
3. Add or update the row in the table in this file so the source of truth stays in sync.
4. For preview monitors, delete the Kuma monitor (and remove the row, if it was added as a one-off) when the PR merges.

## Troubleshooting

If a monitor reports DOWN:

1. Check the latest deploy output: `pnpm exec nx affected -t deploy` or the GitHub Actions run for the affected commit.
2. Check the Cloudflare status page (https://www.cloudflarestatus.com/) for any platform incident.
3. For backend DOWNs, tail the Worker logs: `pnpm --filter backend tail` (uses the `[observability.logs]` config in `apps/backend/wrangler.toml`).
4. For web DOWNs, check the Pages deploy log and the most recent commit on the affected branch.
5. If Kuma itself looks wrong, verify the URL and body-substring expectations still match this file.
```

- [ ] **Step 3: Verify the file is well-formed**

Run:

```bash
cat monitoring/README.md | head -20
```

Expected: the first 20 lines start with `# Uptime Kuma Monitoring` and show the overview paragraph, then the `## Production monitors` heading.

- [ ] **Step 4: Commit**

```bash
git add monitoring/README.md
git commit -m "docs(monitoring): add Uptime Kuma monitor list"
```

---

## Task 4: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full backend test suite**

Run:

```bash
pnpm test:backend
```

Expected: all tests pass, including the new `GET /health` test from Task 1 and every pre-existing case.

- [ ] **Step 2: Run typecheck and lint across the affected projects**

Run:

```bash
pnpm exec nx run backend:type-check
pnpm exec nx run backend:lint
```

Expected: both pass with no new errors or warnings.

- [ ] **Step 3: Inspect the commit log and working tree**

Run:

```bash
git log --oneline -5
git status
```

Expected: three new commits on top of the spec commit (`7b39aaf`), and a clean working tree.

- [ ] **Step 4: Confirm the diff matches the spec**

Run:

```bash
git diff 7b39aaf..HEAD --stat
```

Expected: exactly three files changed:

- `apps/backend/src/app.test.ts` (test added in Task 1)
- `apps/backend/src/index.ts` (route added in Task 2)
- `monitoring/README.md` (created in Task 3)

No other files touched. No changes to `wrangler.toml`, CI, env vars, or any frontend app.

---

## Done

The change is complete. Operator steps that follow this PR (not part of the plan, just context):

1. Create the three production monitors in Kuma from the Production table.
2. For each new preview deploy, add the matching preview monitor and remove it after merge.
