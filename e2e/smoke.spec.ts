import { test, expect } from '@playwright/test'
import { createGymForUser, createTestUser, seedConfig, signInViaForm } from './helpers'

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

// ---------------------------------------------------------------------------
// F019 Display Setup UX -- web-automatable QA smoke scenarios
//
// These mirror two of the six scenarios in
// Context/Features/019-Display-Setup-UX/Tech.md "QA smoke tests" section
// (the four Tauri / native scenarios stay manual). They authenticate against
// the local Supabase that the e2e CI job already starts -- see
// .github/workflows/ci.yml `e2e` job for the equivalent local invocation.
// ---------------------------------------------------------------------------

test('F019 Scenario 1: Show display panel reveals URL + Copy on web', async ({ page, context }) => {
  // Web origin requires clipboard permission for the Copy button to resolve
  // without throwing. We grant it on the browser context, not the page,
  // because Playwright wires permissions per origin via the context.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://localhost:4173',
  })

  await seedConfig(page)
  const user = await createTestUser()
  const gym = await createGymForUser(user, 'F019 Scenario1 Gym')

  await signInViaForm(page, user)

  await page.goto('/profile')

  // The "Show display" button is rendered by every MyGymRow with a
  // data-testid that includes the gym id (per gym-management-section.tsx).
  const showButton = page.getByTestId(`my-gym-row-${gym.id}-show-display`)
  await expect(showButton).toBeVisible()
  await showButton.click()

  // The inline panel renders the URL with the same gym-id-keyed data-testid.
  const urlElement = page.getByTestId(`show-display-url-${gym.id}`)
  await expect(urlElement).toBeVisible()
  await expect(urlElement).toHaveText(`http://localhost:4173/display/gym/${gym.id}`)

  // Click the Copy button -- we cannot reliably round-trip clipboard contents
  // through Playwright on every Chromium build (the secure-context dance
  // varies), so we assert that the click does not throw and that the toast
  // appears via Sonner. Sonner toasts have role="status".
  const copyButton = page.getByTestId(`show-display-copy-${gym.id}`)
  await expect(copyButton).toBeVisible()
  await copyButton.click()
  await expect(page.locator('text=Display URL copied').first()).toBeVisible({ timeout: 5_000 })
})

test('F019 Scenario 4: zero-gym user creates a personal display', async ({ page }) => {
  await seedConfig(page)
  // Fresh signup: no gym memberships because the local DB has no
  // is_default=true gym (the trg_auth_user_default_gym trigger only enrolls
  // when a default gym exists -- see migration 20260407000001_create_gyms.sql).
  const user = await createTestUser()

  await signInViaForm(page, user)

  await page.goto('/display')

  // Zero-gym branch of DisplayDispatcher renders DisplaySetupPanel with
  // both Panel A (existing URL) and Panel B (personal display CTA).
  const panelAInput = page.getByTestId('display-setup-panel-a-input')
  const panelBSubmit = page.getByTestId('display-setup-panel-b-submit')
  await expect(panelAInput).toBeVisible()
  await expect(panelBSubmit).toBeVisible()

  await panelBSubmit.click()

  // The createGym mutation onSuccess navigates to /display/gym/{newId}
  // (DisplaySetupPanel.handleStartPersonal). Wait for the URL transition.
  await page.waitForURL(/\/display\/gym\/[0-9a-f-]{36}/, { timeout: 15_000 })
  const match = page.url().match(/\/display\/gym\/([0-9a-f-]{36})/)
  expect(match).not.toBeNull()

  // Round-trip: navigate back to /profile and verify the new gym shows up
  // in MyGymsList. The derivePersonalGymName helper falls back to
  // "My Training" when displayName is empty (which is the case for a
  // freshly-signed-up user with no profile.displayName set).
  await page.goto('/profile')
  const newGymId = match![1]
  await expect(page.getByTestId(`my-gym-row-${newGymId}`)).toBeVisible({ timeout: 10_000 })
})
