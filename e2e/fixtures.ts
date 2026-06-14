import type { Page, Route } from '@playwright/test'

/**
 * Stub the backend API surface the SPA talks to so the E2E suite is
 * hermetic. The frontend proxies `/api/*` to the backend during dev; in
 * `vite preview` it does not — so the frontend calls either the relative
 * `/api` path (if configured) or the upstream origin. We intercept both at
 * the network layer so tests remain deterministic.
 */
export async function stubBackend(page: Page): Promise<void> {
  await page.route(/\/api(\/|\?|$)/, async (route: Route) => {
    const url = new URL(route.request().url())
    const path = url.pathname

    if (path === '/api' || path === '/api/') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          service: 'ulasim-backend',
          version: '2.0.0',
          status: 'healthy',
          optimizedFor: 'e2e-stub',
          timestamp: new Date().toISOString(),
        }),
      })
    }

    if (path === '/api/stations' || path === '/api/stations/') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 0,
          data: [],
        }),
      })
    }

    if (path === '/api/routes' || path === '/api/routes/') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: 0,
          data: [],
        }),
      })
    }

    // Default: 200 JSON empty — avoids long-hanging requests.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })

  // Upstream denizli and pocketbase: don't hit the real internet.
  await page.route(/denizli\.bel\.tr|ulasim\.denizli\.bel\.tr|u20\.isrky\.dev/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ value: [] }),
    }),
  )
}
