# Feature 014: Mobile Bug Bash

## Overview

Address four high-priority mobile bugs that collectively make the Android app unusable for key flows: QR scanning, Google sign-in, guest mode, and basic layout/display.

## Problem Statement

The Android (Tauri) mobile app has four blocking issues discovered during initial device testing:

1. **QR scanner shows no camera preview** -- the barcode scanner plugin renders the camera behind an opaque WebView, so users scan blind.
2. **Google OAuth fails immediately** -- the opener plugin's `'inAppBrowser'` target is unsupported on Android, preventing the OAuth flow from launching.
3. **Guest mode is completely broken** -- every screen errors because the data adapter requires a Supabase client that doesn't exist in guest/offline mode.
4. **Content overlaps system chrome** -- no safe area inset handling exists, so content renders under the status bar, navigation bar, and rounded display corners.

## Requirements

### Must Have

- B002: QR scanner displays a live camera viewfinder while scanning
- B003: Google OAuth flow launches successfully on Android and completes the sign-in round-trip
- B004: Guest mode users can navigate all screens without errors (data hooks gracefully skip or return empty state)
- B005: App content respects Android system bars (status bar, navigation bar) and rounded display corners with proper insets

### Should Have

- B002: Visual indicator (overlay, frame, crosshair) guiding users where to point the camera
- B005: Edge-to-edge rendering with translucent system bars for a modern Android look

### Won't Have

- iOS support (not currently targeted)
- Offline data sync for guest mode (guest is view-only with empty/mock data)
- Custom in-app browser for OAuth (system browser is sufficient)

## Testable Assertions

- **TA-1**: QR scanner shows live camera feed on Android device; scanning a valid QR code returns the decoded value.
- **TA-2**: Tapping "Continue with Google" opens the system browser to the Google OAuth consent screen; completing consent returns to the app and establishes a session.
- **TA-3**: Tapping "Continue as Guest" navigates to the home screen with no console errors or "failed to" messages on any reachable screen.
- **TA-4**: On a Pixel 10 (or equivalent with rounded corners), no text or interactive elements overlap the status bar, navigation bar, or display corner radius.
- **TA-5**: Safe area insets adapt correctly in both portrait and landscape orientations.

## Scope by Bug

### B002: QR Scanner Camera Feed

**Files involved:**

- `src/routes/setup.tsx` -- `handleScan` method (line 147)
- `src/routes/_authenticated.tsx` -- root layout `bg-background`
- Possibly `src-tauri/` Kotlin/Android config for WebView transparency

**Approach:** Make the WebView background transparent when the scanner activates, restore it when scanning completes or is cancelled.

### B003: Google OAuth on Android

**Files involved:**

- `src/lib/auth.tsx` -- `signInWithGoogle` (line 263), `openUrl` call (line ~290)

**Approach:** Replace `'inAppBrowser'` target with `'default'` for the system browser on Android. Verify the deep link callback (`ardentforge://auth/callback`) still works with the system browser flow.

### B004: Guest Mode Data Adapter

**Files involved:**

- `src/lib/adapter.ts` -- `getAdapter()` function
- `src/lib/auth.tsx` -- `continueAsGuest()` (line 61)
- All `useQuery` hooks that call `getAdapter()`

**Approach:** When `isGuest` is true and no backend is available, return a no-op/stub adapter (or guard data hooks to skip fetching). Guest screens should show empty states, not errors.

### B005: Safe Area Insets

**Files involved:**

- `index.html` -- viewport meta tag
- `src/routes/_authenticated.tsx` -- root layout
- `src/components/mobile-nav.tsx` (or equivalent) -- bottom nav
- `src-tauri/gen/android/` -- Android theme config
- Global CSS / Tailwind config

**Approach:** Add `viewport-fit=cover`, apply `env(safe-area-inset-*)` padding to the root layout and bottom nav, and configure edge-to-edge mode in the Android theme.

## Dependencies

- `tauri-plugin-barcode-scanner` v2.4.4 (already installed)
- `tauri-plugin-opener` (already installed)
- `tauri-plugin-deep-link` (already installed)
- No new dependencies expected

## Resolved Questions

- **B002**: Yes -- `cancel()` is an exported function from `@tauri-apps/plugin-barcode-scanner`. Use it to stop scanning and restore the opaque WebView background.
- **B003**: The current `openUrl(url, 'inAppBrowser')` target was intentionally chosen to use Chrome Custom Tabs (Google blocks OAuth in plain WebViews). The `openUrl` call itself is throwing, so the issue is likely a plugin version or missing Android dependency for CCT -- not a wrong browser target. Debug at the plugin/Android level rather than switching to `'default'`.
- **B004**: Guest mode should only be available in the Tauri mobile app (local SQLite). Hide the guest option on web.
