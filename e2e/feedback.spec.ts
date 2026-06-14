import { expect, test } from '@playwright/test'
import { stubBackend } from './fixtures'

test.beforeEach(async ({ page }) => {
  await stubBackend(page)
})

test('renders the feedback form with default selection', async ({ page }) => {
  await page.goto('/geri-bildirim')

  await expect(page.getByRole('heading', { name: /Geri Bildirim/i, level: 1 })).toBeVisible()

  // The type selector renders a row of buttons; "Öneri" is the default.
  await expect(page.getByRole('button', { name: /^Öneri$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Gönder$/i })).toBeDisabled()
})

test('enables the submit button only after a valid message', async ({ page }) => {
  await page.goto('/geri-bildirim')
  const textarea = page.getByPlaceholder(/en az 10 karakter/i)
  const submit = page.getByRole('button', { name: /^Gönder$/i })

  await expect(submit).toBeDisabled()
  await textarea.fill('Yeterince uzun bir mesaj.')
  await expect(submit).toBeEnabled()
})
