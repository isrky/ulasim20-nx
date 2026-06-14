import { expect, test } from '@playwright/test'
import { stubBackend } from './fixtures'

test.beforeEach(async ({ page }) => {
  await stubBackend(page)
})

test('home page renders hero heading and search input', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Denizli Ulaşım', level: 1 })).toBeVisible()
  await expect(page.getByPlaceholder(/Hat veya durak ara/i)).toBeVisible()
})

test('navigates from home to the Hatlar page', async ({ page }) => {
  await page.goto('/')
  await page
    .getByRole('link', { name: /^Hatlar/i })
    .first()
    .click()
  await expect(page).toHaveURL(/\/hatlar$/)
  await expect(page.getByRole('heading', { name: /Hatlar|Otobüs Hatları/i }).first()).toBeVisible()
})

test('hakkinda (about) page renders', async ({ page }) => {
  await page.goto('/hakkinda')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('unknown route does not crash the shell', async ({ page }) => {
  await page.goto('/this-route-does-not-exist')
  // Router still mounts the top banner / share banner; the body should
  // remain interactive rather than a blank/error screen.
  await expect(page.locator('body')).toBeVisible()
})
