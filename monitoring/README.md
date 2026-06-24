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
