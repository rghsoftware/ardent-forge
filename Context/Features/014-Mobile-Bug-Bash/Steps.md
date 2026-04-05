# Feature 014: Mobile Bug Bash -- Implementation Steps

## Team Composition

| Role                | Domain                              | Bugs                        |
| ------------------- | ----------------------------------- | --------------------------- |
| frontend-specialist | React/TypeScript, CSS, Tailwind     | B002, B004, B005 (frontend) |
| backend-engineer    | Rust/Tauri, Android config, plugins | B003, B005 (native)         |

## Wave 1: Independent Fixes (Parallel)

All four bugs are independent. B002, B003, and B004 are small fixes that can run in parallel. B005 spans both frontend and backend but has no dependency on the others.

---

### S001: B003 -- Fix OAuth permission scope [backend-engineer]

**Goal:** Add scoped opener permission so `openUrl(url, 'inAppBrowser')` is allowed on Android.

**Steps:**

1. Read `src-tauri/capabilities/mobile.json`
2. Add a scoped `opener:allow-open-url` entry with `"app": "inAppBrowser"` for `https://*` URLs
3. Verify the JSON is valid and no duplicate identifiers conflict

**Files:** `src-tauri/capabilities/mobile.json`

**Acceptance:**

- The capability file parses without error
- The scoped entry allows `https://*` with `"app": "inAppBrowser"`

**Testable Assertion:** TA-2

---

### S002: B004 -- Guard guest mode to Tauri-only [frontend-specialist]

**Goal:** Prevent `continueAsGuest()` from executing outside Tauri.

**Steps:**

1. Read `src/lib/auth.tsx`, locate `continueAsGuest()`
2. Add `isTauri()` early return with `console.error('[auth] Guest mode is only available in Tauri')`
3. Verify `isTauri` is already imported (it should be)

**Files:** `src/lib/auth.tsx`

**Acceptance:**

- `continueAsGuest()` returns early with a log when `!isTauri()`
- No behavior change when running in Tauri

**Testable Assertion:** TA-3

---

### S003: B002 -- QR scanner transparency [frontend-specialist]

**Goal:** Make the WebView content transparent during barcode scanning so the camera feed is visible.

**Steps:**

1. Read `src/index.css` and add `.scanner-active` transparency rule:
   ```css
   .scanner-active,
   .scanner-active body,
   .scanner-active #root {
     background: transparent !important;
   }
   ```
2. Read `src/routes/setup.tsx`, locate `handleScan`
3. Add `document.documentElement.classList.add('scanner-active')` before `scan()` call
4. Add `document.documentElement.classList.remove('scanner-active')` in `finally` block
5. Import and call `cancel()` from `@tauri-apps/plugin-barcode-scanner` after successful scan

**Files:** `src/index.css`, `src/routes/setup.tsx`

**Acceptance:**

- `scanner-active` class is added to `<html>` before scan starts
- `scanner-active` class is removed in `finally` (covers success, error, and cancel)
- `cancel()` is called to clean up the scanner

**Testable Assertion:** TA-1

---

### S004: B005 -- Safe area insets (native layer) [backend-engineer]

**Goal:** Install the safe area insets plugin and configure the Android native layer.

**Steps:**

1. Add `tauri-plugin-safe-area-insets-css` to `src-tauri/Cargo.toml`
2. Read `src-tauri/src/lib.rs` and register `.plugin(tauri_plugin_safe_area_insets_css::init())`
3. Read `index.html` and add `viewport-fit=cover` to the viewport meta tag
4. Check `src-tauri/gen/android/app/src/main/AndroidManifest.xml` and add `android:windowSoftInputMode="adjustResize"` to the activity if not present

**Files:** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `index.html`, `AndroidManifest.xml` (if needed)

**Acceptance:**

- Plugin is registered in the Tauri builder chain
- `viewport-fit=cover` is present in the viewport meta tag
- Rust project compiles with the new plugin

**Testable Assertion:** TA-4 (partial -- native layer ready)

---

### S005: B005 -- Safe area insets (frontend layer) [frontend-specialist]

**Depends on:** S004

**Goal:** Add CSS custom properties and apply safe area padding to layout components.

**Steps:**

1. Run `bun add @saurl/tauri-plugin-safe-area-insets-css-api`
2. Read `src/main.tsx` and add conditional import of the JS API:
   ```typescript
   if ('__TAURI_INTERNALS__' in window) {
     import('@saurl/tauri-plugin-safe-area-insets-css-api')
   }
   ```
3. Read `src/index.css` and add the CSS variable fallback chain:
   ```css
   :root {
     --sai-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
     --sai-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
     --sai-left: env(safe-area-inset-left, 0px);
     --sai-right: env(safe-area-inset-right, 0px);
   }
   ```
4. Read `src/routes/_authenticated.tsx` and apply `pt-[var(--sai-top)]` to the root layout container
5. Find the mobile bottom nav component and apply `pb-[var(--sai-bottom)]` padding

**Files:** `package.json`, `src/main.tsx`, `src/index.css`, `src/routes/_authenticated.tsx`, mobile nav component

**Acceptance:**

- CSS custom properties are defined with fallback chain
- Root layout has top safe area padding
- Bottom nav has bottom safe area padding
- Web app is unaffected (variables fall back to `0px`)

**Testable Assertions:** TA-4, TA-5

---

## Wave 2: Verification

### S006: Build verification [backend-engineer]

**Depends on:** S001, S003, S004, S005

**Goal:** Verify the project builds successfully with all changes.

**Steps:**

1. Run `bun run build` to verify TypeScript compilation
2. Run `bun run test` to verify no test regressions

**Acceptance:**

- TypeScript build passes
- All existing tests pass

---

## Milestone: All Bugs Addressed

**Testable Assertions:** TA-1 through TA-5 require on-device verification (Android emulator or physical device). The build verification (S006) confirms no regressions in the web build.

## Execution Summary

| Step | Bug  | Agent               | Depends On | Parallel |
| ---- | ---- | ------------------- | ---------- | -------- |
| S001 | B003 | backend-engineer    | --         | Yes      |
| S002 | B004 | frontend-specialist | --         | Yes      |
| S003 | B002 | frontend-specialist | --         | Yes      |
| S004 | B005 | backend-engineer    | --         | Yes      |
| S005 | B005 | frontend-specialist | S004       | No       |
| S006 | All  | backend-engineer    | S001-S005  | No       |

**Recommended execution:** `/impl 014` -- tasks are isolated with one sequential dependency (S005 after S004). No cross-domain coordination needed.
