import { test, expect } from '@playwright/test'

const FAKE_CONFIG = JSON.stringify({
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseKey: 'fake-anon-key-for-e2e',
})

/**
 * Seed localStorage with a fake backend config so the root route guard
 * allows navigation to auth pages instead of redirecting to /setup.
 */
async function seedConfig(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate((config) => localStorage.setItem('ardentforge:config', config), FAKE_CONFIG)
}

// ---------------------------------------------------------------------------
// Sign-in page
// ---------------------------------------------------------------------------

test('sign-in page renders email and password fields', async ({ page }) => {
  await seedConfig(page)
  await page.goto('/sign-in')

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('sign-in page shows Google OAuth button', async ({ page }) => {
  await seedConfig(page)
  await page.goto('/sign-in')

  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
})

test('sign-in page has link to sign-up', async ({ page }) => {
  await seedConfig(page)
  await page.goto('/sign-in')

  const signUpLink = page.getByRole('link', { name: 'Sign up' })
  await expect(signUpLink).toBeVisible()
  await expect(signUpLink).toHaveAttribute('href', /sign-up/)
})

test('sign-in page has link to forgot password', async ({ page }) => {
  await seedConfig(page)
  await page.goto('/sign-in')

  const forgotLink = page.getByRole('link', { name: /forgot password/i })
  await expect(forgotLink).toBeVisible()
  await expect(forgotLink).toHaveAttribute('href', /forgot-password/)
})

// ---------------------------------------------------------------------------
// Sign-up page
// ---------------------------------------------------------------------------

test('sign-up page renders with all form fields', async ({ page }) => {
  await seedConfig(page)
  await page.goto('/sign-up')

  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Confirm password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
})

test('sign-up page has link back to sign-in', async ({ page }) => {
  await seedConfig(page)
  await page.goto('/sign-up')

  const signInLink = page.getByRole('link', { name: 'Sign in' })
  await expect(signInLink).toBeVisible()
  await expect(signInLink).toHaveAttribute('href', /sign-in/)
})

// ---------------------------------------------------------------------------
// Forgot password page
// ---------------------------------------------------------------------------

test('forgot-password page renders', async ({ page }) => {
  await seedConfig(page)
  await page.goto('/forgot-password')

  await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()
})

// ---------------------------------------------------------------------------
// Unauthenticated redirect
// ---------------------------------------------------------------------------

test('unauthenticated visit to root redirects to sign-in', async ({ page }) => {
  await seedConfig(page)
  // Navigate to the authenticated root -- should redirect to /sign-in
  await page.goto('/')
  await page.waitForURL(/sign-in/)

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})
