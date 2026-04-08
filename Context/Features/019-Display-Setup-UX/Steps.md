# Implementation Steps: Display Setup UX (F019)

**Spec:** [Spec.md](./Spec.md)
**Tech:** [Tech.md](./Tech.md)

## Progress

- **Status:** Draft (not started)
- **Current task:** --
- **Last milestone:** --

## Team Orchestration

### Team Members

- **fe-broadcast**
  - Role: Display dispatcher, chooser, setup panel, URL parser, discovery endpoint extension
  - Agent Type: frontend-specialist
  - Resume: true
- **fe-ui**
  - Role: Profile inline panel, gym-management integration, config-store extension, shared helpers, setup.tsx persistence, QR scanner hook extraction
  - Agent Type: frontend-specialist
  - Resume: true
- **validator**
  - Role: Final read-only validation against Spec.md testable assertions
  - Agent Type: quality-engineer
  - Resume: false

### Recommended execution mode

`/impl 019` (hub-and-spoke). Tasks are decoupled by file path; the only cross-team seams are the Wave 1 contracts which are stable once published. No peer-to-peer coordination required — `/team-impl` would be over-kill for this scope.

---

## Tasks

### Wave 1: Foundation primitives

Pure modules with zero runtime dependencies on each other or on existing code. All four can land in parallel. Everything downstream imports these.

- [ ] **S001:** Create `src/lib/display-url.ts` exporting `parseDisplayUrlInput`, `buildDisplayUrl`, `isDevOrigin`, and the `ParseResult` discriminated-union type per Tech.md D2/D3/D4 module contract. Pure, React-free, no Tauri imports. Handles trailing slashes, query strings, and fragments in the parser. Implements Spec.md **M13** (accepted input shapes) and **M23** (parser module exists).
  - **Assigned:** fe-broadcast
  - **Depends:** none
  - **Parallel:** true
- [ ] **S001-T:** Colocated Vitest tests at `src/lib/__tests__/display-url.test.ts`. Cover: `parseDisplayUrlInput` with full URL, path-only, bare UUID, whitespace, trailing slash, query string, fragment, empty, malformed, non-UUID tail. `buildDisplayUrl(id, origin)` with valid origin, null origin, dev origin. `isDevOrigin` with `localhost:5173`, `http://127.0.0.1`, `http://[::1]:3000`, production URLs. Implements Spec.md **TA9, TA10, TA11, TA15, TA21**.
  - **Assigned:** fe-broadcast
  - **Depends:** S001
  - **Parallel:** false

- [ ] **S002:** Create `src/lib/display-setup.ts` exporting `derivePersonalGymName(displayName: string | null | undefined): string`. 48-char code-point clamp via `[...str].slice(0, 48).join('')` per Tech.md D5 + risks row for Unicode. Fallback to `"My Training"` on empty/whitespace. Pure, no dependencies. Implements Spec.md **M16** (name derivation).
  - **Assigned:** fe-ui
  - **Depends:** none
  - **Parallel:** true
- [ ] **S002-T:** Colocated Vitest tests at `src/lib/__tests__/display-setup.test.ts`. Cover: `'Alice'` → `"Alice's Training"`, `null`/`undefined`/`''`/`'   '` → `"My Training"`, 100-char input clamps to 48-char prefix + suffix fits under 60 chars, emoji grapheme at boundary does not split a code point. Implements Spec.md **TA14**.
  - **Assigned:** fe-ui
  - **Depends:** S002
  - **Parallel:** false

- [ ] **S003:** Extract `gymErrorMessage(err, action)` and `isPgError(err)` from `src/components/profile/gym-management-section.tsx` into a new `src/lib/gym-error-messages.ts` module per Tech.md D10. Update `gym-management-section.tsx` to import from the new module (keeps its tests green). Do NOT add a re-export from the component file — a direct import is cleaner and the section is the only existing caller.
  - **Assigned:** fe-ui
  - **Depends:** none
  - **Parallel:** true
- [ ] **S003-T:** Colocated Vitest tests at `src/lib/__tests__/gym-error-messages.test.ts`. Cover: every PG error code branch (`23505`, `42501`, `PGRST116`, default) for each action (`create`, `join`, `leave`, `delete`). `isPgError` boundary cases: string, number, `null`, object with only `code`, object with only `message`, object with neither.
  - **Assigned:** fe-ui
  - **Depends:** S003
  - **Parallel:** false

- [ ] **S004:** Create `src/lib/copy-to-clipboard.ts` exporting `copyToClipboard(text, options)` per Tech.md D11 module contract. Wraps `navigator.clipboard.writeText` with try/catch, `[module-name]` logging per `.claude/rules/error-handling.md`, and Sonner toast feedback on both paths. Returns `Promise<boolean>` so callers can chain on success. Supports a `logPrefix` option defaulting to `'clipboard'`.
  - **Assigned:** fe-ui
  - **Depends:** none
  - **Parallel:** true
- [ ] **S004-T:** Colocated Vitest tests at `src/lib/__tests__/copy-to-clipboard.test.ts`. Spy on `navigator.clipboard.writeText` and `toast`. Assert: success path returns `true` and fires success toast; rejected promise path returns `false`, fires failure toast, and logs `console.error` with `[clipboard]` prefix; custom `logPrefix` is used when provided.
  - **Assigned:** fe-ui
  - **Depends:** S004
  - **Parallel:** false

🏁 **MILESTONE M1:** Foundation primitives in place.

**Contracts published:**

- `parseDisplayUrlInput(raw: string): ParseResult` (display-url.ts)
- `buildDisplayUrl(gymId: string, origin: string | null): string | null` (display-url.ts)
- `isDevOrigin(origin: string): boolean` (display-url.ts)
- `derivePersonalGymName(displayName: string | null | undefined): string` (display-setup.ts)
- `gymErrorMessage(err: unknown, action: 'create' | 'join' | 'leave' | 'delete'): string` (gym-error-messages.ts)
- `copyToClipboard(text: string, options: CopyOptions): Promise<boolean>` (copy-to-clipboard.ts)

Verifies against Spec.md **TA9, TA10, TA11, TA14, TA15, TA21**.

---

### Wave 2: Backend extension + config schema

Additive, backward-compatible changes to the discovery endpoint and config schema. Unlocks the appUrl flow for Wave 3.

- [ ] **S005:** Extend `api/discovery.ts` to include `app_url` in the JSON response, derived via a new `computeAppUrl(req)` helper per Tech.md D21. Uses `req.headers['x-forwarded-proto']` (default `'https'`) + `req.headers.host`. Logs a warn and omits `app_url` if `host` is missing (degraded, not broken). Leave the CORS, OPTIONS, and existing env-var error-path handling unchanged.
  - **Assigned:** fe-broadcast
  - **Depends:** none
  - **Parallel:** true
- [ ] **S005-T:** Create `api/__tests__/discovery.test.ts` (or add to an existing discovery test file if one exists). Mock `VercelRequest`/`VercelResponse` shapes. Assert: response includes `app_url`; `computeAppUrl` defaults `proto` to `https`; `x-forwarded-proto: 'http'` yields `http://`; missing `host` logs a warn and returns without `app_url`; OPTIONS preflight still returns 204; missing env vars still return 500.
  - **Assigned:** fe-broadcast
  - **Depends:** S005
  - **Parallel:** false

- [ ] **S006:** Extend `backendConfigSchema` in `src/lib/config-store.ts` to include `appUrl: z.string().url().optional()` per Tech.md D6. Zod `.optional()` keeps pre-existing persisted configs valid. The `BackendConfig` type gains the field automatically. Do NOT bump a schema version or clear configs on parse failure — backward compat is the goal.
  - **Assigned:** fe-ui
  - **Depends:** none
  - **Parallel:** true
- [ ] **S006-T:** Extend existing `src/lib/__tests__/config-store.test.ts`. Assert: `backendConfigSchema` accepts a config without `appUrl` (backward compat); accepts a config with a valid `appUrl`; rejects a config with a non-URL `appUrl` (e.g., `'not-a-url'`); `BrowserConfigStore.setConfig` + `getConfig` round-trips `appUrl`; same for `TauriConfigStore` with mocked `invoke`.
  - **Assigned:** fe-ui
  - **Depends:** S006
  - **Parallel:** false

🏁 **MILESTONE M2:** App URL plumbing ready.

**Contracts published:**

- `api/discovery.ts` response shape: `{ version, supabase_url, supabase_publishable_key, app_url? }`
- `backendConfigSchema` accepts optional `appUrl: string (url)`
- `BackendConfig` type gains optional `appUrl: string | undefined`

---

### Wave 3: Setup refactor and persistence

QR scanner extraction (safe refactor) in parallel with setup-flow persistence of `appUrl`.

- [ ] **S007:** Extract `useQrScanner()` from the `handleScan` function in `src/routes/setup.tsx:163-209` into a new `src/hooks/use-qr-scanner.ts` per Tech.md D12 module contract. Returns `null` outside Tauri (`isTauri() === false`). Exposes `{ scanning, scan, cancel }` per the UseQrScannerResult interface. Preserves the existing webview-transparent / scanner-active class management.
  - **Assigned:** fe-ui
  - **Depends:** none
  - **Parallel:** true
- [ ] **S007-T:** Colocated Vitest tests at `src/hooks/__tests__/use-qr-scanner.test.tsx` with mocked `@tauri-apps/plugin-barcode-scanner` and `@tauri-apps/api/core`. Cover: hook returns null when `isTauri()` returns false; `scan()` resolves with decoded content on success; `scan()` resolves with null on user cancel; permission-denied path calls `openAppSettings` and resolves null; scanner-active class is added on start and removed on completion.
  - **Assigned:** fe-ui
  - **Depends:** S007
  - **Parallel:** false
- [ ] **S007-V:** Refactor `src/routes/setup.tsx` to consume `useQrScanner()`. Behavior must be byte-identical — the existing setup tests (`src/routes/__tests__/-setup.test.tsx`) must pass without modification. Run the full setup test suite to prove zero regression.
  - **Assigned:** fe-ui
  - **Depends:** S007
  - **Parallel:** false

- [ ] **S008:** Update the discovery callback in `src/routes/setup.tsx` (or `src/lib/discovery.ts` if the project has a separate discovery module) to parse the new `app_url` field from the response and pass it into `setConfig({ supabaseUrl, supabaseKey, appUrl })`. When `app_url` is absent (pre-F019 server or discovery error), log a single warn with `[setup]` prefix and proceed — the user will land in the D22 backfill path on their first Show-display tap.
  - **Assigned:** fe-ui
  - **Depends:** S005, S006
  - **Parallel:** false
- [ ] **S008-T:** Add an integration test at `src/routes/__tests__/-setup.test.tsx` (or colocate with existing setup tests). Mock the discovery `fetch` to return `{ app_url: 'https://example.com', ... }`. Assert: `setConfig` is called with `appUrl === 'https://example.com'`. Second test: mock discovery to return without `app_url`. Assert: `setConfig` is called with `appUrl === undefined` and a warn is logged.
  - **Assigned:** fe-ui
  - **Depends:** S008
  - **Parallel:** false

🏁 **MILESTONE M3:** Setup flow populates `appUrl`.

**Contracts published:**

- Fresh Tauri setups end with `config.appUrl` populated when the server returns it.
- Existing persisted configs remain valid (no breakage).
- `useQrScanner()` hook available for reuse.

---

### Wave 4: Profile inline panel

The `ShowDisplayPanel` component and its integration into `MyGymRow`. Delivers Spec.md M1-M5, M24, S1.

- [ ] **S009:** Create `src/components/profile/show-display-panel.tsx` per Tech.md D18. Props: `{ gym: Gym; isOpen: boolean; onToggle: () => void }`. Resolves origin: web → `window.location.origin`; Tauri → reads `config.appUrl` from `getConfigStore().getConfig()` (or equivalent cached accessor). Renders:
  - Valid origin → URL text + `copyToClipboard`-backed Copy button + `QRCodeSVG` (192×192, `max-w-full`) + dev-origin warning caption when `isDevOrigin(origin)`.
  - Null origin → **D22 backfill form** (server URL input, Save button, "What is this?" popover). On Save, fetches `${input}/api/discovery`, validates the response with `backendConfigSchema`, calls `setConfig` to merge `appUrl`, and re-renders. Uses `[display-setup]` log prefix and inline error on failure.
    Implements Spec.md **M1, M2, M3, M4, M5, M24, S1, S2, S3, D22**.
  - **Assigned:** fe-ui
  - **Depends:** S001, S004, S006
  - **Parallel:** false
- [ ] **S009-T:** Colocated Vitest tests at `src/components/profile/__tests__/show-display-panel.test.tsx`. Cover:
  - Renders URL + Copy + QR when origin is valid (web mock).
  - Renders URL + Copy + QR when origin comes from Tauri `config.appUrl`.
  - Renders D22 backfill form when origin is null (Tauri with missing `appUrl`).
  - Backfill Save happy path: mock `fetch`, mock `setConfig`, assert `appUrl` persisted and panel transitions to URL state.
  - Backfill Save error path: mock `fetch` to reject, assert inline error message and form stays open.
  - Dev-origin warning visible on `localhost:5173`, absent on production URL.
  - Copy button calls `copyToClipboard` with the URL and surfaces a toast.
    Implements Spec.md **TA1, TA2, TA3, TA4, TA21**.
  - **Assigned:** fe-ui
  - **Depends:** S009
  - **Parallel:** false

- [ ] **S010:** Integrate `ShowDisplayPanel` into `src/components/profile/gym-management-section.tsx`. Changes:
  - `MyGymsList` gains `useState<string | null>(null)` for `openRowId` (single-row-open per Tech.md D13).
  - `MyGymRow` gains props `isExpanded: boolean` and `onToggle: () => void`.
  - `MyGymRow` renders a new "Show display" ghost button in the button row (between Leave and Delete, or after Leave if not owner). All members see it.
  - When `isExpanded === true`, render `<ShowDisplayPanel gym={gym} isOpen={true} onToggle={...} />` directly beneath the row content (inside the `<li>`).
  - Update the `gymErrorMessage` import to use `@/lib/gym-error-messages` (per S003).
    Implements Spec.md **M1, M11** (not just owners), **S1** (single-row-open).
  - **Assigned:** fe-ui
  - **Depends:** S003, S009
  - **Parallel:** false
- [ ] **S010-T:** Update `src/components/profile/__tests__/gym-management-section.test.tsx`. Cover:
  - "Show display" button present on a row where the current user is the owner.
  - "Show display" button present on a row where the current user is NOT the owner (just a member).
  - Tapping "Show display" on row A renders the panel for A.
  - Tapping "Show display" on row B while A is open closes A and opens B (single-row-open invariant).
  - Tapping "Show display" on row A again when A is open closes A (toggle).
    Implements Spec.md **TA1**.
  - **Assigned:** fe-ui
  - **Depends:** S010
  - **Parallel:** false

🏁 **MILESTONE M4:** Inline display panel shipping.

**Contracts published:**

- Profile → GYMS → My gyms shows a per-row "Show display" action.
- Inline panel renders URL + Copy + QR for web and Tauri with `appUrl` populated.
- D22 backfill form repairs pre-F019 and Advanced-mode Tauri configs in place.

Verifies against Spec.md **TA1, TA2, TA3, TA4, TA21**.

---

### Wave 5: Dispatcher primitives and sub-views

The `/display` dispatcher, its state machine, and its three sub-views. Delivers Spec.md M6-M21.

- [ ] **S011:** Create `computeDispatcherState` pure function + the `DispatcherState` discriminated union per Tech.md D7 in a shared module at `src/components/display/dispatcher-state.ts` (separate from the component file so it's unit-testable without rendering anything). Six variants: `unauthenticated`, `loading`, `error`, `zero`, `single(gymId)`, `many(gyms)`. Precedence rules: auth loading → `loading`; not authenticated → `unauthenticated`; gyms query error → `error`; gyms query loading → `loading`; empty gyms → `zero`; 1 gym → `single`; 2+ gyms → `many`.
  - **Assigned:** fe-broadcast
  - **Depends:** none
  - **Parallel:** true
- [ ] **S011-T:** Colocated Vitest tests at `src/components/display/__tests__/dispatcher-state.test.ts`. One test per state branch. Cover: auth-loading precedence beats gyms-loading; unauthenticated beats everything once auth resolves; error state holds `refetch`; single state holds the gym ID; many state holds the full gym array. Implements Spec.md **TA5, TA6, TA8** preconditions.
  - **Assigned:** fe-broadcast
  - **Depends:** S011
  - **Parallel:** false

- [ ] **S012:** Create `src/components/display/display-chooser.tsx` per Tech.md D14 + Spec.md M10, M11. Props: `{ gyms: Gym[]; userId: string }`. Renders:
  - A page wrapper matching `.claude/rules/layout-conventions.md` (`min-h-[100dvh] bg-surface-anvil` + `mx-auto max-w-5xl px-4 md:px-6 lg:px-8`).
  - An ALL-CAPS page title "SELECT DISPLAY".
  - One row per membership as `<Link to="/display/gym/$gymId" params={{ gymId: gym.id }}>` with the gym name in uppercase tracking, visual tokens referenced from (but not imported from) `GymPickerSheet`.
  - At the bottom, a muted-tonal "Start a personal display" row that triggers `useCreateGym` with `derivePersonalGymName(profile?.displayName)` (reads `useUserProfile(userId)` to get displayName). On success, navigates via `useNavigate` with `replace: true` to the new gym's display route. On error, renders an inline `role="alert"` paragraph using `gymErrorMessage(err, 'create')`.
    Implements Spec.md **M10, M11, TA6, TA7, TA23**.
  - **Assigned:** fe-broadcast
  - **Depends:** S002, S003
  - **Parallel:** true
- [ ] **S012-T:** Colocated Vitest tests at `src/components/display/__tests__/display-chooser.test.tsx`. Cover:
  - Renders N rows for N memberships.
  - Each row is a `<Link>` with the correct `to` and `params`.
  - "Start a personal display" row present at the bottom.
  - Tapping the personal-display row calls `createGym` with the derived name.
  - `createGym` error path surfaces inline error.
  - Middle-click / keyboard navigation still works on the Link rows (verify via `userEvent.keyboard`).
    Implements Spec.md **TA6, TA7, TA23**.
  - **Assigned:** fe-broadcast
  - **Depends:** S012
  - **Parallel:** false

- [ ] **S013:** Create `src/components/display/display-setup-panel.tsx` per Tech.md D14 + Spec.md M12-M18. Props: `{ userId: string }`. Renders:
  - Page wrapper per layout conventions.
  - A one-sentence explanation (Spec S5): "Connect a TV at an existing gym, or broadcast only your own workouts to a personal display."
  - **Panel A:** Text input (auto-focused via ref+effect per Tech.md D19), accepts full URL / path-only / bare UUID. On Submit (Enter key or Submit button), pipes input through `parseDisplayUrlInput`. On `ok: true`, calls `navigate({ to: '/display/gym/$gymId', params: { gymId } })`. On `ok: false`, renders an inline error derived from the `reason` field. Includes a "Scan QR" button that is visible only when `useQrScanner()` returns non-null (Tauri-only); on tap, opens the scanner and feeds the result back through the parser.
  - **Panel B:** "Start a personal display" CTA. On click, calls `useCreateGym().mutate({ name: derivePersonalGymName(profile?.displayName) })`. `onSuccess(newGym)` → `navigate({ to: '/display/gym/$gymId', params: { gymId: newGym.id }, replace: true })`. `onError` → inline error via `gymErrorMessage(err, 'create')`. Button shows "Creating…" while pending.
    Implements Spec.md **M12-M18, S5-S7, S10-S11, TA8, TA9, TA10, TA11, TA12, TA13, TA22**.
  - **Assigned:** fe-broadcast
  - **Depends:** S001, S002, S003, S007
  - **Parallel:** false
- [ ] **S013-T:** Colocated Vitest tests at `src/components/display/__tests__/display-setup-panel.test.tsx`. Cover:
  - Panel A auto-focuses the input on mount.
  - Panel A accepts a full URL shape and navigates with the extracted gymId.
  - Panel A accepts a path-only shape and navigates.
  - Panel A accepts a bare UUID and navigates.
  - Panel A rejects malformed input with an inline error and does not navigate.
  - Panel A accepts Enter key as submit.
  - Scan QR button absent when `useQrScanner()` returns null; present when it returns non-null.
  - Mocked scan result feeds through the parser and navigates on success.
  - Mocked scan result of non-UUID surfaces "Scanned code is not a display URL" toast.
  - Panel B success path calls createGym with derived name and navigates via `replace`.
  - Panel B error path renders inline error using gymErrorMessage.
  - Panel B button shows "Creating…" while pending.
    Implements Spec.md **TA8, TA9, TA10, TA11, TA12, TA13, TA22**.
  - **Assigned:** fe-broadcast
  - **Depends:** S013
  - **Parallel:** false

- [ ] **S014:** Create `src/components/display/display-dispatcher.tsx` per Tech.md D14. Reads `useAuth()` and `useGyms(user?.id)`, feeds them into `computeDispatcherState`, and switches on the resulting state kind to render one of: inline `<LegacyNotConfiguredPage />` (unauthenticated), `<DispatcherLoadingState />` (loading — lighter skeleton than the TV route per O2), `<DispatcherErrorState retry={state.retry} />` (error), `<DisplaySetupPanel userId={user.id} />` (zero), `<Navigate to="/display/gym/$gymId" params={{ gymId: state.gymId }} replace />` (single), `<DisplayChooser gyms={state.gyms} userId={user.id} />` (many). Inline `LegacyNotConfiguredPage` preserves the exact copy from the existing `src/routes/display/index.tsx` (Spec M20). Implements Spec.md **M6, M7, M8, M9, M20**.
  - **Assigned:** fe-broadcast
  - **Depends:** S011, S012, S013
  - **Parallel:** false
- [ ] **S014-T:** Colocated Vitest tests at `src/components/display/__tests__/display-dispatcher.test.tsx`. One test per state branch using mocked `useAuth` and `useGyms`:
  - Unauthenticated → LegacyNotConfiguredPage rendered with the exact F018 copy.
  - Loading (auth loading) → skeleton present, no setup UI leaked.
  - Loading (gyms loading) → skeleton present.
  - Error → error state with Retry button that calls `refetch`.
  - Zero gyms → `<DisplaySetupPanel>` rendered.
  - Single gym → `<Navigate replace>` fires with correct params (mock Navigate as a spy component).
  - Many gyms → `<DisplayChooser>` rendered with the full gym list.
    Implements Spec.md **TA5, TA6, TA8, TA15, TA16, TA17**.
  - **Assigned:** fe-broadcast
  - **Depends:** S014
  - **Parallel:** false

🏁 **MILESTONE M5:** Dispatcher components ready.

**Contracts published:**

- `computeDispatcherState` pure function for 6-state decisions.
- `DisplayDispatcher` component renders correct branch per state.
- `DisplayChooser` and `DisplaySetupPanel` each cover their Spec requirements.

Verifies against Spec.md **TA5, TA6, TA7, TA8, TA9, TA10, TA11, TA12, TA13, TA15, TA16, TA17, TA22, TA23**.

---

### Wave 6: Wire up the /display route

- [ ] **S015:** Replace `src/routes/display/index.tsx` with a thin route wrapper: `createFileRoute('/display/')({ component: DisplayDispatcherRoute })` where `DisplayDispatcherRoute` is a ~5-line function returning `<DisplayDispatcher />`. No logic in the route file. Preserve any search-param validation if needed (none in the current file). Implements Spec.md **M6, M15** (routing), **M19** (nav entry unchanged), **M21** (discovery-dot unchanged).
  - **Assigned:** fe-broadcast
  - **Depends:** S014
  - **Parallel:** false
- [ ] **S015-T:** Integration tests at `src/routes/display/__tests__/-dispatcher-route.test.tsx`. Mount a real `<RouterProvider>` with a mocked adapter. Cover:
  - **TA5:** Mock auth=authenticated + `listUserGyms` → [{ id: 'gym-A' }]. Navigate to `/display`. Assert router history shows `/display/gym/gym-A` via `replace` (back button does not return to `/display`).
  - **TA6:** Mock `listUserGyms` → [{ id: 'A' }, { id: 'B' }]. Assert chooser rendered with two Link rows.
  - **TA8:** Mock `listUserGyms` → []. Assert Panel A and Panel B visible.
  - **TA13:** Mock `listUserGyms` → [], mock `createGym` → `{ id: 'new-gym', name: "Alice's Training", ... }`. Click "Start a personal display". Assert router navigates to `/display/gym/new-gym` with replace.
  - **TA17:** Mock `useAuth().user === null`. Assert LegacyNotConfiguredPage rendered with exact F018 copy.
    Implements Spec.md **TA5, TA6, TA8, TA13, TA17**.
  - **Assigned:** fe-broadcast
  - **Depends:** S015
  - **Parallel:** false

- [ ] **S015-D:** Update `.claude/tasks/` session notes with the final file list touched by the PR (for the review-capture workflow). Confirm no drift from Tech.md's File Structure section.
  - **Assigned:** fe-broadcast
  - **Depends:** S015
  - **Parallel:** false

🏁 **MILESTONE M6:** `/display` dispatcher live on `develop`.

**Contracts published:**

- `/display` is a smart dispatcher for authenticated users.
- `/display/gym/$gymId` is **unchanged** (Spec.md TA18 verified by the fact that no diff appears in that file).

Verifies against Spec.md **TA5, TA6, TA8, TA13, TA17, TA18**.

---

### Wave 7: Final validation

Read-only QA. Nothing to build. Catches anything the per-task tests missed.

- [ ] **S016-QA:** Manual Tauri Android smoke tests per Tech.md "QA smoke tests (manual, one-time)". Execute all six scenarios on a real Tauri Android build pointed at the dev Supabase instance:
  1. Web copy → TV loads.
  2. Tauri fresh-setup copy → TV loads; host is the Vercel URL, not `tauri://localhost`.
  3. Tauri pre-F019 config backfill → D22 form repairs config → URL renders.
  4. Tauri 0-gym personal display creation → new gym appears, TV loads.
  5. Tauri QR scan → navigates correctly.
  6. Self-hosted docker-compose: configure instance with `SITE_URL=https://forge.example.com`, point Tauri at it, verify display URL uses that host.
     Document results in `.claude/tasks/<plan-file>.md` with timestamps and screenshots.
  - **Assigned:** fe-ui
  - **Depends:** S010, S015
  - **Parallel:** false

- [ ] **S017-V:** Read-only validation pass against all 23 Spec.md testable assertions (TA1-TA23) plus the zero-blast-radius guarantees (TA18: `/display/gym/$gymId.tsx` diff empty; TA19: zero new SQL migrations; TA20: zero new domain types). The validator does NOT modify files. Produces a structured PASS/FAIL report in the session file. Implements the Spec.md **Verification** column for every M/S requirement.
  - **Assigned:** validator
  - **Depends:** S016-QA
  - **Parallel:** false

🏁 **MILESTONE M7:** Feature complete, validated, ready for PR to `develop`.

---

## Summary

- **Total tasks:** 27 (13 implementation, 11 tests, 1 refactor verification, 1 doc, 1 QA smoke, 1 validation)
- **Wave count:** 7
- **Parallel opportunities:** Wave 1 (4 tasks), Wave 2 (2 tasks), Wave 5 parallel subset (S011 + S012 can run alongside each other before S013/S014)
- **Estimated critical path:** S001 → S005 → S008 → S009 → S010 → S015-T → S016-QA → S017-V (through Wave 4 work on S010, Wave 5 work depends on Wave 3, Wave 6 depends on Wave 5, Wave 7 depends on Wave 4 and Wave 6)
- **New files:** 10 source + 10 test (matches Tech.md's File Structure)
- **Modified files:** 6 (`api/discovery.ts`, `src/lib/config-store.ts`, the discovery callback, `src/routes/display/index.tsx`, `src/components/profile/gym-management-section.tsx`, `src/routes/setup.tsx`)
- **Zero-change files proven by tests:** `src/routes/display/gym/$gymId.tsx`, `supabase/migrations/*`, `src/domain/types/gym.ts`

## Cross-cutting checks (every task)

Every task must satisfy these before being marked complete:

1. **Error handling** per `.claude/rules/error-handling.md`: `[module-name]` log prefix, no bare `catch {}`, no silent fallbacks, user-action guards with visible error state.
2. **TypeScript conventions** per `.claude/rules/typescript-conventions.md`: exhaustive `Record` types use `satisfies`, domain-keyed records use union keys.
3. **Layout** per `.claude/rules/layout-conventions.md`: authenticated pages use `mx-auto max-w-5xl` wrapper with progressive padding.
4. **React/TS** per `.claude/rules/react-typescript.md`: functional components, hooks with proper deps, icon-only buttons have `aria-label`, 48px touch targets.
5. **State management** per `.claude/rules/state-management.md`: Zustand stores validate at their boundaries (not relevant here — no new stores).
6. **Supabase** per `.claude/rules/supabase.md`: RLS (not touched), trigger patterns (not touched), client cleanup (not touched).
7. **Tests colocated** in `__tests__/` subdirectories next to the file under test.
8. **bun/bunx only** — never npx/npm/yarn per user memory.
