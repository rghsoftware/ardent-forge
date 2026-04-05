import { test, expect } from '@playwright/test'

test('app loads without crashing', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Ardent Forge/i)
})

test('auth page renders', async ({ page }) => {
  await page.goto('/sign-in')
  await expect(page.locator('form')).toBeVisible()
})
