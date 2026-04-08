import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// E2E helpers for the F019 (Display Setup UX) web scenarios.
//
// The existing E2E suite (smoke.spec.ts) is auth-less -- the two scaffold
// tests use a fake config that never reaches a real Supabase. The F019 tests
// need an authenticated user with controlled gym memberships, so this module
// provides:
//
//   - SUPABASE_URL / SUPABASE_PUB_KEY: read from env (set by CI before
//     running tests, see .github/workflows/ci.yml `e2e` job)
//   - seedConfig(page): inject the real config into localStorage BEFORE the
//     SPA boots, via Playwright's addInitScript (so the root route guard
//     allows authenticated routes to load instead of redirecting to /setup)
//   - createTestUser(): hits the local Supabase auth API to create a fresh
//     email-confirmed user; returns email, password, userId, and access token
//   - createGymForUser(): inserts a gym row via the REST API as the test
//     user; the trg_gym_owner_enroll trigger automatically enrolls them as
//     a member (see migration 20260407000004_enroll_gym_creator.sql)
//
// All helpers use random emails per invocation to keep tests isolated.
// ---------------------------------------------------------------------------

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
export const SUPABASE_PUB_KEY =
  process.env.VITE_SUPABASE_PUB_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

const REAL_CONFIG = JSON.stringify({
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_PUB_KEY,
})

/**
 * Inject the real Supabase config into localStorage before the page loads.
 * Must be called BEFORE `page.goto()` so the root route guard sees the
 * config when it runs `getConfigStore().hasConfig()`.
 *
 * Mirrors the pattern used by the existing scaffold tests but with a real
 * URL/key pair so the Supabase client can authenticate.
 */
export async function seedConfig(page: Page): Promise<void> {
  await page.addInitScript((config) => {
    localStorage.setItem('ardentforge:config', config)
  }, REAL_CONFIG)
}

interface TestUser {
  email: string
  password: string
  userId: string
  accessToken: string
  client: SupabaseClient
}

/**
 * Create a fresh test user against the local Supabase auth API. Email
 * confirmations are disabled in supabase/config.toml so signUp returns a
 * usable session immediately.
 *
 * Each invocation uses a random email so tests can run in parallel without
 * stomping on each other.
 */
export async function createTestUser(): Promise<TestUser> {
  const random = Math.random().toString(36).slice(2, 10)
  const email = `e2e-${random}@e2e.test`
  const password = 'E2eTest12345!'

  const client = createClient(SUPABASE_URL, SUPABASE_PUB_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: false },
  })

  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw new Error(`[e2e-helpers] signUp failed: ${error.message}`)
  const session = data.session
  const user = data.user
  if (!session || !user) {
    throw new Error(
      '[e2e-helpers] signUp returned no session -- email confirmations may be enabled',
    )
  }

  return { email, password, userId: user.id, accessToken: session.access_token, client }
}

/**
 * Create a gym owned by the given test user. The
 * trg_gym_owner_enroll trigger fires after insert and adds the owner to
 * gym_members automatically (per migration 20260407000004), so the user
 * appears in their own MyGymsList immediately afterward.
 */
export async function createGymForUser(user: TestUser, name: string): Promise<{ id: string }> {
  const { data, error } = await user.client
    .from('gyms')
    .insert({ name, owner_user_id: user.userId })
    .select('id')
    .single()
  if (error) throw new Error(`[e2e-helpers] createGym failed: ${error.message}`)
  if (!data?.id) throw new Error('[e2e-helpers] createGym returned no id')
  return { id: data.id }
}

/**
 * Sign the test user in via the rendered sign-in form. We drive the form
 * (rather than poking the supabase client directly in the page context)
 * because the AuthProvider hydrates state via onAuthStateChange, which only
 * fires inside the running app.
 */
export async function signInViaForm(page: Page, user: TestUser): Promise<void> {
  await page.goto('/sign-in')
  await page.locator('input#email').fill(user.email)
  await page.locator('input#password').fill(user.password)
  await page.locator('form button[type="submit"]').click()
  // After successful sign-in the app navigates to "/" -- wait for the
  // route to settle on something authenticated rather than the sign-in form.
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 })
}
