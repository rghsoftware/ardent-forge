# Bugs Backlog

Known bugs not blocking current work. Add entries via the backlog-add skill.
High-priority bugs should be addressed before starting new features.

<!-- Add new bugs below this line -->

## ~~B001: invokeCommand does not log before re-throwing~~ (Resolved 2026-04-04)

**Severity:** High
**File:** `src/lib/tauri-adapter.ts:516`
**Resolution:** Added `console.error('[tauri-adapter] invokeCommand(${cmd}) failed:', e)` before the re-throw. All 140 tauri-adapter tests pass.

### B002: QR code scanner does not show live camera feed

**Added:** 2026-04-05
**Context:** The QR code scanner in the mobile app doesn't display the camera's live video feed. Users see no visual feedback from the camera while scanning.
**Related:** Mobile QR scanner feature, camera integration
**Priority:** High

### B003: Google OAuth fails with "Failed to open the sign-in browser"

**Added:** 2026-04-05
**Context:** Tapping "Continue with Google" on the mobile app shows "Failed to open the sign-in browser" instead of launching the OAuth flow.
**Related:** OAuth/auth flow, Tauri deep linking, mobile browser integration
**Priority:** High

### B004: Guest mode shows failure errors on all screens

**Added:** 2026-04-05
**Context:** When using the mobile app in guest mode, every screen displays a "failed to ..." error message. Guest/unauthenticated users cannot browse the app at all.
**Related:** Guest mode, auth guards, offline/anonymous access
**Priority:** High

### B005: App content overlaps Android system chrome

**Added:** 2026-04-05
**Context:** The mobile app does not account for Android system UI (status bar, navigation bar) or rounded display corners. Content needs safe area insets so it doesn't sit underneath the system chrome, and padding for curved screen edges -- e.g., on a Pixel 10 the "F" in "Forge" overflows into the corner radius.
**Related:** Mobile layout, safe area insets, Tauri Android WebView
**Priority:** Medium
