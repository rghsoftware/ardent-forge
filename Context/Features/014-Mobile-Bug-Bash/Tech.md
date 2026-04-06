# Feature 014: Mobile Bug Bash -- Technical Plan

## Architecture Overview

Four independent bug fixes targeting the Android (Tauri) mobile experience. No shared dependencies between fixes -- they can be implemented in parallel.

---

## B002: QR Scanner Camera Feed

### Root Cause

The `tauri-plugin-barcode-scanner` with `windowed: true` already makes the **native Android WebView container** transparent and renders the camera behind it. However, the HTML/CSS content inside the WebView is opaque (`bg-background` on the root layout in `_authenticated.tsx`), which paints over the transparent WebView and hides the camera feed.

### Approach: CSS-Only Toggle

No Rust changes needed. The plugin handles native WebView transparency automatically.

1. **Add a `scanner-active` CSS class on `<html>`** when scanning starts, remove it when scanning ends
2. **Global CSS rule** makes all layers transparent:
   ```css
   .scanner-active,
   .scanner-active body,
   .scanner-active #root {
     background: transparent !important;
   }
   ```
3. **Toggle in scan handler** (`src/routes/setup.tsx`):
   ```typescript
   const handleScan = async () => {
     document.documentElement.classList.add('scanner-active')
     try {
       const result = await scan({ windowed: true, formats: [Format.QRCode] })
       await cancel()
       await processInviteLink(result.content)
     } catch (err) {
       console.error('[setup] Barcode scan failed:', err)
     } finally {
       document.documentElement.classList.remove('scanner-active')
     }
   }
   ```

### Files

| File                   | Change                                                                    |
| ---------------------- | ------------------------------------------------------------------------- |
| `src/routes/setup.tsx` | Toggle `scanner-active` class in `handleScan`, call `cancel()` after scan |
| `src/index.css`        | Add `.scanner-active` transparency rule                                   |

### Fallback

If the plugin's auto-transparency is insufficient on some devices, use `getCurrentWebview().setBackgroundColor([0, 0, 0, 0])` from `@tauri-apps/api/webview` as a manual override.

---

## B003: Google OAuth Browser Launch

### Root Cause

**Permission scope mismatch** in Tauri's capability system. The `opener:allow-default-urls` permission defines URL entries with no `app` field, which deserializes as `Application::Default`. When `openUrl(url, 'inAppBrowser')` is called, the Rust-side scope check requires the `Application` variant to match the `with` parameter. `Application::Default.matches(Some("inAppBrowser"))` returns `false`, so the call is rejected with a forbidden URL error.

This is a known issue: tauri-apps/plugins-workspace#3075.

### Approach: Add Scoped Permission

Add an explicit scope entry in `mobile.json` that allows `https://*` URLs with the `"inAppBrowser"` app target.

```json
{
  "identifier": "opener:allow-open-url",
  "allow": [
    {
      "url": "https://*",
      "app": "inAppBrowser"
    }
  ]
}
```

### Files

| File                                 | Change                                                                |
| ------------------------------------ | --------------------------------------------------------------------- |
| `src-tauri/capabilities/mobile.json` | Add scoped `opener:allow-open-url` entry with `"app": "inAppBrowser"` |

### No Code Changes

The `signInWithGoogle` function in `src/lib/auth.tsx` is correct. The `openUrl(url, 'inAppBrowser')` call will work once the permission scope allows it.

---

## B004: Guest Mode Errors

### Root Cause

`continueAsGuest()` in `src/lib/auth.tsx` does not enforce `isTauri()`. While the UI button and session restoration are both gated to Tauri, the function itself is unguarded. If called outside Tauri (or if localStorage is tampered with), `getAdapter()` throws because there is no Supabase client in guest/web mode.

### Approach: Guard at Auth Level

Add a single `isTauri()` check in `continueAsGuest()`. No stub adapter needed -- the existing architecture is correct:

- In Tauri: `getAdapter()` returns `TauriAdapter` with `GUEST_USER_ID` fallback (works with local SQLite)
- On web: `getAdapter()` throws (correct -- no storage backend for guest data)

```typescript
const continueAsGuest = () => {
  if (!isTauri()) {
    console.error('[auth] Guest mode is only available in Tauri')
    return
  }
  setState({ user: SYNTHETIC_GUEST_USER, session: null, loading: false, isGuest: true })
  localStorage.setItem(GUEST_STORAGE_KEY, 'true')
}
```

### Files

| File               | Change                                       |
| ------------------ | -------------------------------------------- |
| `src/lib/auth.tsx` | Add `isTauri()` guard in `continueAsGuest()` |

---

## B005: Safe Area Insets and Rounded Corners

### Root Cause

The app already calls `enableEdgeToEdge()` in `MainActivity.kt` (required at targetSdk 36), so it draws under system bars. But there is zero CSS padding to compensate -- no `viewport-fit=cover`, no `env(safe-area-inset-*)`, no inset custom properties.

**Critical finding:** `env(safe-area-inset-*)` returns `0px` on Android WebView (Chromium bug, versions below ~144). A native bridge is required to get real inset values.

### Approach: Tauri Plugin + CSS Custom Properties

**Layer 1: HTML meta tag**

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

**Layer 2: Native inset plugin**

Use `tauri-plugin-safe-area-insets-css` (by saurL) which:

- Reads native `WindowInsets` on Android
- Auto-injects `--safe-area-inset-top` and `--safe-area-inset-bottom` as CSS custom properties
- Sets `--safe-area-inset-bottom` to `0` when keyboard is visible

**Layer 3: CSS fallback chain**

```css
:root {
  --sai-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
  --sai-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
  --sai-left: env(safe-area-inset-left, 0px);
  --sai-right: env(safe-area-inset-right, 0px);
}
```

Apply to root layout and bottom nav using `pt-[var(--sai-top)]` and `pb-[var(--sai-bottom)]`.

**Rounded corners:** Safe area insets on most devices are large enough to clear the corner radius. No extra corner-specific logic needed.

### Files

| File                            | Change                                                        |
| ------------------------------- | ------------------------------------------------------------- |
| `index.html`                    | Add `viewport-fit=cover` to viewport meta tag                 |
| `src-tauri/Cargo.toml`          | Add `tauri-plugin-safe-area-insets-css` dependency            |
| `src-tauri/src/lib.rs`          | Register `.plugin(tauri_plugin_safe_area_insets_css::init())` |
| `package.json`                  | Add `@saurl/tauri-plugin-safe-area-insets-css-api`            |
| `src/main.tsx`                  | Import the JS API (conditionally for Tauri)                   |
| `src/index.css`                 | Define `--sai-*` fallback chain CSS variables                 |
| `src/routes/_authenticated.tsx` | Apply `pt-[var(--sai-top)]` to root layout                    |
| Mobile nav component            | Apply `pb-[var(--sai-bottom)]` to bottom nav                  |

### Optional Enhancements

- `AndroidManifest.xml`: Add `android:windowSoftInputMode="adjustResize"` so WebView resizes for keyboard
- `themes.xml`: Set transparent status/nav bar colors (may already be handled by `enableEdgeToEdge()`)

---

## Risk Assessment

| Bug  | Risk                                                         | Mitigation                                                                   |
| ---- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| B002 | `!important` overrides could affect other UI during scanning | Scope CSS rule narrowly; restore class in `finally` block                    |
| B003 | Duplicate `opener:allow-open-url` entries in capabilities    | Tauri merges scope entries -- tested pattern from issue #3075                |
| B004 | Minimal risk -- single guard clause                          | Existing UI and restoration gates are already Tauri-gated                    |
| B005 | Third-party plugin (`safe-area-insets-css`) reliability      | Fallback chain degrades to `env()` then `0px`; plugin is actively maintained |
| B005 | Plugin must not run outside Tauri                            | Guard import with `isTauri()` check                                          |

## New Dependencies

| Dependency                                     | Type        | Purpose                                   |
| ---------------------------------------------- | ----------- | ----------------------------------------- |
| `tauri-plugin-safe-area-insets-css`            | Rust crate  | Native safe area inset values as CSS vars |
| `@saurl/tauri-plugin-safe-area-insets-css-api` | npm package | JS-side initialization for the plugin     |

## No ADRs Required

All fixes are bug corrections using established patterns (Tauri plugins, CSS custom properties, capability scoping). No architectural decisions are being introduced.
