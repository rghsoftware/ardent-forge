import { test, expect } from '@playwright/test'

const FAKE_CONFIG = JSON.stringify({
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseKey: 'fake-anon-key-for-e2e',
})

test('app loads without crashing', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Ardent Forge/i)
})

test('auth page renders', async ({ page }) => {
  // Seed localStorage so the root route guard allows navigation to /sign-in
  // instead of redirecting to /setup (no stored config in a fresh browser).
  await page.goto('/')
  await page.evaluate((config) => localStorage.setItem('ardentforge:config', config), FAKE_CONFIG)
  await page.goto('/sign-in')
  await expect(page.locator('form')).toBeVisible()
})
