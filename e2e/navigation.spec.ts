import { test, expect } from '@playwright/test'

const FAKE_CONFIG = JSON.stringify({
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseKey: 'fake-anon-key-for-e2e',
})

/**
 * Seed localStorage with a fake backend config so the root route guard
 * allows navigation instead of redirecting to /setup.
 */
async function seedConfig(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate((config) => localStorage.setItem('ardentforge:config', config), FAKE_CONFIG)
}

// ---------------------------------------------------------------------------
// Setup page (no config)
// ---------------------------------------------------------------------------

test('setup page renders when no config is present', async ({ page }) => {
  // Do NOT seed config -- the root guard should redirect to /setup
  await page.goto('/')
  await page.waitForURL(/setup/)

  await expect(page.getByRole('heading', { name: 'Connect to server' })).toBeVisible()
  await expect(page.getByLabel('Server address')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible()
})

test('setup page has manual configuration toggle', async ({ page }) => {
  await page.goto('/setup')

  const toggle = page.getByRole('button', { name: /manual configuration/i })
  await expect(toggle).toBeVisible()

  // Expanding the toggle should reveal Supabase URL and Publishable Key fields
  await toggle.click()
  await expect(page.getByLabel('Supabase URL')).toBeVisible()
  await expect(page.getByLabel('Publishable Key')).toBeVisible()
})

test('setup page shows self-hosting link', async ({ page }) => {
  await page.goto('/setup')

  const link = page.getByRole('link', { name: /setup guide/i })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', /github\.com/)
})

// ---------------------------------------------------------------------------
// Route transitions between public pages
// ---------------------------------------------------------------------------

test('navigating from sign-in to sign-up works', async ({ page }) => {
  await seedConfig(page)
  await page.goto('/sign-in')

  await page.getByRole('link', { name: 'Sign up' }).click()
  await page.waitForURL(/sign-up/)

  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible()
})

test('navigating from sign-up to sign-in works', async ({ page }) => {
  await seedConfig(page)
  await page.goto('/sign-up')

  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.waitForURL(/sign-in/)

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('navigating from sign-in to forgot-password works', async ({ page }) => {
  await seedConfig(page)
  await page.goto('/sign-in')

  await page.getByRole('link', { name: /forgot password/i }).click()
  await page.waitForURL(/forgot-password/)

  await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible()
})

test('navigating from forgot-password back to sign-in works', async ({ page }) => {
  await seedConfig(page)
  await page.goto('/forgot-password')

  await page.getByRole('link', { name: /back to sign in/i }).click()
  await page.waitForURL(/sign-in/)

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

// ---------------------------------------------------------------------------
// Authenticated route guards
// ---------------------------------------------------------------------------

test('authenticated routes redirect to sign-in without a session', async ({ page }) => {
  await seedConfig(page)

  // Try several authenticated routes -- all should redirect to sign-in
  const protectedRoutes = ['/history', '/library', '/vault', '/profile']

  for (const route of protectedRoutes) {
    await page.goto(route)
    await page.waitForURL(/sign-in/, { timeout: 5000 })
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  }
})
