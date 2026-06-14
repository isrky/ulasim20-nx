import { expect, test } from '@playwright/test'
import { stubBackend } from './fixtures'

test.beforeEach(async ({ page }) => {
  await stubBackend(page)
  // Leaflet tile requests — stub so we don't hit real CDNs in CI.
  await page.route(/tile\.openstreetmap|basemaps|mapbox|cartodb|openfreemap/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) }),
  )
})

test('map page mounts without uncaught errors', async ({ page }) => {
  const errors: Error[] = []
  page.on('pageerror', (err) => errors.push(err))

  await page.goto('/harita')
  // Give Leaflet a beat to mount.
  await page.waitForTimeout(500)

  expect(errors, `uncaught errors: ${errors.map((e) => e.message).join(', ')}`).toEqual([])
})
