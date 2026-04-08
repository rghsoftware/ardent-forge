# F019 Implementation Session: Display Setup UX

**Plan:** Context/Features/019-Display-Setup-UX/Steps.md
**Branch:** worktree-feat+multipe-instance-display
**Started:** 2026-04-07

## Team Roster

- **fe-broadcast** — frontend-specialist — display dispatcher, chooser, setup panel, URL parser, discovery endpoint
- **fe-ui** — frontend-specialist — profile panel, gym-management integration, config-store, shared helpers, setup.tsx persistence
- **validator** — quality-engineer — final read-only validation

## Execution Mode

Central AI implements directly for Waves 1-6 (small module files, no cross-cutting complexity). Sub-agents would add overhead without improving quality. Validator runs in Wave 7.

## Progress Log

### Wave 1: Foundation primitives — DONE (M1 ✅)

- S001 display-url.ts
- S001-T display-url.test.ts (24 tests)
- S002 display-setup.ts
- S002-T display-setup.test.ts (12 tests)
- S003 gym-error-messages.ts (extracted from gym-management-section.tsx)
- S003-T gym-error-messages.test.ts (24 tests)
- S004 copy-to-clipboard.ts
- S004-T copy-to-clipboard.test.ts (6 tests)

### Wave 2: Backend extension + config schema — DONE (M2 ✅)

- S005 api/discovery.ts: computeAppUrl helper, additive `app_url` field
- S005-T api/**tests**/discovery.test.ts (12 tests)
- S006 src/lib/config-store.ts: backendConfigSchema gains optional appUrl
- S006-T extended config-store.test.ts (5 new tests for appUrl round-trip)

### Wave 3: Setup refactor and persistence — DONE (M3 ✅)

- S007 src/hooks/use-qr-scanner.ts (Tauri-only barcode scanner hook)
- S007-T src/hooks/**tests**/use-qr-scanner.test.tsx (8 tests)
- S007-V Refactored src/routes/setup.tsx to consume the hook (existing 4 tests still pass)
- S008 Discovery callback in setup.tsx persists app_url; src/lib/discovery.ts schema extended
- S008-T 2 new tests in -setup.test.tsx + 4 new tests in discovery.test.ts for app_url

### Wave 4: Profile inline panel — DONE (M4 ✅)

- S009 src/components/profile/show-display-panel.tsx (URL + Copy + QR + dev-warning + D22 backfill)
- S009-T src/components/profile/**tests**/show-display-panel.test.tsx (10 tests)
- S010 Integrated ShowDisplayPanel into gym-management-section: single-row-open state, "Show display" button on all rows
- S010-T 4 new integration tests in gym-management-section.test.tsx

### Wave 5: Dispatcher primitives and sub-views — DONE (M5 ✅)

- S011 src/components/display/dispatcher-state.ts (pure 6-variant state machine)
- S011-T src/components/display/**tests**/dispatcher-state.test.ts (11 tests)
- S012 src/components/display/display-chooser.tsx (2+ gym chooser + personal display row)
- S012-T src/components/display/**tests**/display-chooser.test.tsx (9 tests)
- S013 src/components/display/display-setup-panel.tsx (Panel A URL input + Panel B personal CTA)
- S013-T src/components/display/**tests**/display-setup-panel.test.tsx (16 tests)
- S014 src/components/display/display-dispatcher.tsx (state machine + branching + inline LegacyNotConfiguredPage)
- S014-T src/components/display/**tests**/display-dispatcher.test.tsx (7 tests)

### Wave 6: Wire up /display route — DONE (M6 ✅)

- S015 src/routes/display/index.tsx replaced with thin DisplayDispatcher wrapper
- S015-T src/routes/display/**tests**/-dispatcher-route.test.tsx (5 integration tests for TA5/TA6/TA8/TA13/TA17)
- S015-D Final file list verified against Tech.md File Structure section (this update)
- Existing -gym-route.test.tsx updated to mock useAuth/useGyms for the dispatcher

## Final File List

### New source files (12)

- `src/lib/display-url.ts`
- `src/lib/display-setup.ts`
- `src/lib/gym-error-messages.ts`
- `src/lib/copy-to-clipboard.ts`
- `src/hooks/use-qr-scanner.ts`
- `src/components/profile/show-display-panel.tsx`
- `src/components/display/dispatcher-state.ts`
- `src/components/display/display-dispatcher.tsx`
- `src/components/display/display-chooser.tsx`
- `src/components/display/display-setup-panel.tsx`

### New test files (12)

- `src/lib/__tests__/display-url.test.ts`
- `src/lib/__tests__/display-setup.test.ts`
- `src/lib/__tests__/gym-error-messages.test.ts`
- `src/lib/__tests__/copy-to-clipboard.test.ts`
- `api/__tests__/discovery.test.ts`
- `src/hooks/__tests__/use-qr-scanner.test.tsx`
- `src/components/profile/__tests__/show-display-panel.test.tsx`
- `src/components/display/__tests__/dispatcher-state.test.ts`
- `src/components/display/__tests__/display-dispatcher.test.tsx`
- `src/components/display/__tests__/display-chooser.test.tsx`
- `src/components/display/__tests__/display-setup-panel.test.tsx`
- `src/routes/display/__tests__/-dispatcher-route.test.tsx`

### Modified source files (6)

- `api/discovery.ts` — `app_url` field via `computeAppUrl(req)`
- `src/lib/config-store.ts` — `backendConfigSchema` gains optional `appUrl`
- `src/lib/discovery.ts` — `DiscoveryResult.appUrl`, schema extension
- `src/routes/setup.tsx` — consumes `useQrScanner`, persists `appUrl`
- `src/routes/display/index.tsx` — thin wrapper rendering `DisplayDispatcher`
- `src/components/profile/gym-management-section.tsx` — single-row-open state, ShowDisplayPanel integration, gymErrorMessage import

### Modified test files (5)

- `src/lib/__tests__/config-store.test.ts` — appUrl round-trip
- `src/lib/__tests__/discovery.test.ts` — app_url passthrough + warn
- `src/routes/__tests__/-setup.test.tsx` — appUrl persistence assertions
- `src/components/profile/__tests__/gym-management-section.test.tsx` — Show display integration tests
- `src/routes/display/__tests__/-gym-route.test.tsx` — auth/use-gyms mocks for dispatcher

### Zero-change files (proven by empty git diff against HEAD)

- `src/routes/display/gym/$gymId.tsx` (TA18)
- `supabase/migrations/*` (TA19)
- `src/domain/types/*` (TA20)

---

## Wave 7: Final Validation (S017-V) — 2026-04-07

### Test suite

- Full repo: **2,350 tests passing across 122 test files** (zero regressions)
- F019-specific (new + modified): 162 tests across 12 new files + 5 modified files
- Lint: clean
- Build: clean (`bun run build` succeeds in 645ms; existing chunk warnings unrelated)

### Spec.md Testable Assertions (TA1-TA23)

| ID   | Assertion                                                                        | Verification                                                                                               | Status |
| ---- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| TA1  | "Show display" button on every gym row, visible to all members                   | `gym-management-section.test.tsx` "renders Show display button on every row (owner and non-owner)"         | PASS   |
| TA2  | Tap reveals inline panel with URL + Copy + QR                                    | `show-display-panel.test.tsx` "renders URL + Copy + QR when origin is valid"                               | PASS   |
| TA3  | URL pattern `${origin}/display/gym/${gymId}`                                     | `show-display-panel.test.tsx` asserts `urlEl.textContent` matches the canonical pattern                    | PASS   |
| TA4  | Copy calls `navigator.clipboard.writeText` and fires success toast               | `show-display-panel.test.tsx` "Copy button calls copyToClipboard with the URL and expected messages"       | PASS   |
| TA5  | Single-gym → `/display` navigates (replace) to `/display/gym/{id}`               | `-dispatcher-route.test.tsx` "renders Navigate replace to the user only gym"                               | PASS   |
| TA6  | 2+ gyms → chooser lists every membership                                         | `-dispatcher-route.test.tsx` "renders one Link row per membership"                                         | PASS   |
| TA7  | Each chooser row is an `<a href>`                                                | `display-chooser.test.tsx` "renders one Link row per gym" + asserts `href` attribute                       | PASS   |
| TA8  | Zero gyms → setup UI with Panel A + Panel B                                      | `-dispatcher-route.test.tsx` "renders both Panel A and Panel B"                                            | PASS   |
| TA9  | Panel A accepts a full URL, navigates                                            | `display-setup-panel.test.tsx` "accepts a full URL and navigates with the parsed gym id"                   | PASS   |
| TA10 | Panel A accepts a bare UUID, navigates                                           | `display-setup-panel.test.tsx` "accepts a bare UUID"                                                       | PASS   |
| TA11 | Panel A rejects malformed input with inline error and does not navigate          | `display-setup-panel.test.tsx` "rejects malformed input with an inline error and does not navigate"        | PASS   |
| TA12 | Panel A Scan QR button absent on web, present on Tauri                           | `display-setup-panel.test.tsx` "Scan QR button is absent / present" pair                                   | PASS   |
| TA13 | Panel B createGym + replace navigate on success                                  | `-dispatcher-route.test.tsx` "clicks Create personal display, calls createGym, and navigates with replace" | PASS   |
| TA14 | Personal-gym name derivation (`'s Training` / `'My Training'` fallback)          | `display-setup.test.ts` covers all branches                                                                | PASS   |
| TA15 | Dispatcher loading state does not flash setup/chooser                            | `display-dispatcher.test.tsx` "renders loading state while gyms are loading" + leak assertions             | PASS   |
| TA16 | Error state with Retry that calls `refetch`                                      | `display-dispatcher.test.tsx` "renders error state with Retry that calls refetch"                          | PASS   |
| TA17 | Unauthenticated → preserved legacy "DISPLAY NOT CONFIGURED" copy                 | `-dispatcher-route.test.tsx` "renders the F018-shipped DISPLAY NOT CONFIGURED copy unchanged"              | PASS   |
| TA18 | `src/routes/display/gym/$gymId.tsx` zero diff                                    | `git diff HEAD -- src/routes/display/gym/$gymId.tsx` returns empty                                         | PASS   |
| TA19 | Zero new SQL migrations                                                          | `git diff HEAD -- supabase/migrations/` returns empty                                                      | PASS   |
| TA20 | Zero new domain types                                                            | `git diff HEAD -- src/domain/types/` returns empty                                                         | PASS   |
| TA21 | Dev-origin warning visible on localhost, absent on production                    | `show-display-panel.test.tsx` "renders the dev-origin warning for localhost" + production negative test    | PASS   |
| TA22 | Panel A Enter key submits                                                        | `display-setup-panel.test.tsx` "accepts Enter key as submit"                                               | PASS   |
| TA23 | 2+-gym chooser "Start a personal display" mirrors Panel B's createGym + navigate | `display-chooser.test.tsx` "tapping Start a personal display calls createGym" + "onSuccess navigates"      | PASS   |

### Summary

All 23 testable assertions verified. All zero-blast-radius guarantees confirmed. Feature is complete and ready for the manual Tauri Android smoke pass (S016-QA, six scenarios) and PR to develop.

### S016-QA (smoke scenarios — split into automated + manual)

After the initial pass deferred S016-QA wholesale, a follow-up automated the two web-reachable scenarios via Playwright. The four Tauri-native scenarios remain manual.

**Automated (Playwright e2e, run in CI under `e2e` job):**

| #   | Scenario                              | Test name                                                       |
| --- | ------------------------------------- | --------------------------------------------------------------- |
| 1   | Web "Show display" panel → URL + Copy | `F019 Scenario 1: Show display panel reveals URL + Copy on web` |
| 4   | Web 0-gym → personal display creation | `F019 Scenario 4: zero-gym user creates a personal display`     |

New files:

- `e2e/helpers.ts` — auth/seed helpers (`seedConfig`, `createTestUser`, `createGymForUser`, `signInViaForm`) against the local Supabase instance the CI e2e job already starts
- `e2e/smoke.spec.ts` — extended with the two F019 tests above

E2E results: 4/4 passing (2 pre-existing + 2 F019). Lint clean. Unit tests still 2350/2350.

**Still manual (Tauri Android device required):**

| #   | Scenario                                         | Why manual                                                                           |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 2   | Tauri fresh-setup copy → TV loads, host correct  | Playwright cannot simulate the Tauri WebView host header that distinguishes from web |
| 3   | Tauri pre-F019 config → D22 backfill form        | Requires Tauri SQLite mutation + app restart                                         |
| 5   | Tauri Panel A → native QR scan                   | Requires `@tauri-apps/plugin-barcode-scanner` + real device camera                   |
| 6   | Self-hosted docker-compose `SITE_URL` host check | Requires running a separate Caddy + Vercel function deployment                       |

**Coverage delta:** 2 of 6 scenarios are now automated; 4 remain manual but are appropriately scoped to physical device verification.
