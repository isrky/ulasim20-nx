# Uptime Kuma Monitoring Design

Date: 2026-06-21
Status: Approved
Scope: Configure Uptime Kuma (an external, self-hosted service) to monitor this project's deployed URLs.

## Goal

Give the team a single, reviewable document that tells an operator exactly which URLs to point Uptime Kuma at, with what settings, so production and preview environments are continuously monitored.

## Non-goals

- Deploying or hosting Uptime Kuma itself.
- Configuring Kuma notifications (email, Telegram, etc.).
- Monitoring third-party dependencies (upstream planner API, PocketBase, route API).
- Embedding Kuma's status badge into the web app.
- Adding a `/health` endpoint to `apps/web` (the web app is a static SPA on Cloudflare Pages and its 200 response is sufficient).

## Approach

A single new doc at the repo root (`monitoring/README.md`) listing every monitor that should exist in Kuma, plus a tiny `GET /health` endpoint on the Hono backend so Kuma has a stable, cheap URL to hit. Config-as-data is overkill for the current surface area (three production monitors); the README is the source of truth.

## File changes

### New file: `monitoring/README.md`

Structure:

1. **Overview** — one paragraph: this document lists the URLs Uptime Kuma should monitor for this project. Kuma itself runs externally; this file is the source of truth for what it should be checking.
2. **Production monitors** — table with columns: Name, URL, Type, Expected status, Interval, Timeout, Notes.
3. **Preview monitors** — same shape, with a note that preview monitors are per-deploy: add when a preview is created, remove after the PR merges.
4. **How to add a new monitor** — short paragraph describing the convention (URLs come from `wrangler.toml` / Pages project settings / deploy output).
5. **Troubleshooting** — 3–4 bullets for "if a monitor is DOWN, check X" (e.g. check `pnpm exec nx affected -t deploy` output, check Cloudflare status, etc.).

### Modified file: `apps/backend/src/index.ts`

Add a single route, placed alongside the existing `/`, `/api`, and `/api/` health-style endpoints:

```ts
app.get('/health', (c) => c.json({ status: 'ok' }))
```

- No auth, no KV/R2 reads, no upstream calls.
- Pure 200 + JSON, so a flapping health check can never cause a real incident and the route stays cheap on the Cloudflare Workers free tier.
- Coexists with the existing `/`, `/api`, `/api/` endpoints — those continue to return the full "healthy envelope" body that the frontend's `checkBackendStatus()` calls, while `/health` is the minimal URL for Kuma.

### Modified file: `apps/backend/src/app.test.ts`

Add one new `it` to the existing `describe('Hono app — health', ...)` block, using the same `SELF.fetch` pattern as the existing cases:

```ts
it('GET /health returns { status: "ok" }', async () => {
  const res = await SELF.fetch('http://localhost/health')
  expect(res.status).toBe(200)
  const body = (await res.json()) as { status: string }
  expect(body.status).toBe('ok')
})
```

## Monitor entries (the contents of the README tables)

### Production

| Name | URL | Type | Expected | Interval | Timeout | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Prod web (homepage) | `https://ulasim20.com/` | HTTP(s) | `200` | 60s | 5s | Custom domain, referenced from `apps/web/public/sitemap.xml`. |
| Prod web (sitemap) | `https://ulasim20.com/sitemap.xml` | HTTP(s) | `200` | 60s | 5s | Sanity-checks that the SPA bundle is being served (a homepage 200 alone could be a CDN cache hit). |
| Prod backend health | `https://api.ulasim20.com/health` | HTTP(s) | `200`, body contains `"status":"ok"` | 60s | 5s | New endpoint added by this change. Custom domain from `apps/backend/wrangler.toml` routes. |

### Preview (per-deploy, add when created, remove after merge)

| Name | URL pattern | Type | Expected | Interval | Timeout | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Preview web | `https://<commit-sha>--ulasim20-pages.pages.dev/` | HTTP(s) | `200` | 60s | 5s | Cloudflare Pages preview URL. `<commit-sha>` is the short SHA from the deploy. |
| Preview backend health | `https://ulasim-backend.<account-subdomain>.workers.dev/health` | HTTP(s) | `200`, body contains `"status":"ok"` | 60s | 5s | Cloudflare Workers preview environment. `<account-subdomain>` is the per-account Workers subdomain. |

## Component summary

| Unit | Purpose | Used by |
| --- | --- | --- |
| `monitoring/README.md` | Human-readable source of truth for what Kuma should monitor. | Operator when configuring Kuma; reviewers when monitoring scope changes. |
| `GET /health` on Hono app | Stable, cheap endpoint that returns `{ "status": "ok" }`. | Uptime Kuma (production + preview); trivially safe for any other client. |
| Vitest case for `/health` | Guards the endpoint's contract. | `pnpm test:backend` and CI. |

## Error handling

- `/health` cannot fail in any interesting way: no I/O, no auth, no upstream calls. If it returns non-200, something is wrong with the Hono app itself or the Worker runtime, which Kuma's DOWN alert is exactly the right signal for.
- README's Troubleshooting section points operators at: (a) recent deploy output (`pnpm exec nx affected -t deploy`), (b) Cloudflare status page, (c) GitHub Actions run for the affected commit, (d) Hono logs in `apps/backend/wrangler.toml` `[observability.logs]`.

## Testing

- Backend: the new Vitest case above, run via `pnpm test:backend`.
- Frontend: no change, no test.
- README: documentation only; review-by-PR. (A Markdown link checker can be added later if the team wants — YAGNI today.)

## Rollout

1. Land the `/health` endpoint + its test in one commit.
2. Land `monitoring/README.md` in the same PR (the diff is tiny).
3. Operator creates the three production monitors in Kuma manually, using the README as the spec.
4. For each new preview deploy, operator adds the matching preview monitor and removes it after the PR merges.

No CI changes, no deploy changes, no env-var changes, no frontend changes.