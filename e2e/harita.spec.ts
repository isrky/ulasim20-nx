import { expect, test } from '@playwright/test'

test('harita: line deep link renders the line panel', async ({ page }) => {
  await page.goto('/harita?line=320')
  await expect(page.getByText(/320/)).toBeVisible({ timeout: 10_000 })
})

test('harita: refill deep link shows the refill panel', async ({ page }) => {
  await page.goto('/harita?lat=37.7765&lng=29.0864&type=refill&name=Test&type=refill')
  await expect(page.getByText('Nasıl giderim')).toBeVisible({ timeout: 10_000 })
})
