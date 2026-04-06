# Bugs Backlog

Known bugs not blocking current work. Add entries via the backlog-add skill.
High-priority bugs should be addressed before starting new features.

<!-- Add new bugs below this line -->

## ~~B001: invokeCommand does not log before re-throwing~~ (Resolved 2026-04-04)

**Severity:** High
**File:** `src/lib/tauri-adapter.ts:516`
**Resolution:** Added `console.error('[tauri-adapter] invokeCommand(${cmd}) failed:', e)` before the re-throw. All 140 tauri-adapter tests pass.

## ~~B002: QR code scanner does not show live camera feed~~ (Resolved 2026-04-05)

**Severity:** High
**Resolution:** Feature 014 (Mobile Bug Bash) -- S003: Added `.scanner-active` transparency class and scanner cleanup. Commit `d5c9fe9`.

## ~~B003: Google OAuth fails with "Failed to open the sign-in browser"~~ (Resolved 2026-04-05)

**Severity:** High
**Resolution:** Feature 014 (Mobile Bug Bash) -- S001: Added scoped `opener:allow-open-url` capability. Commit `d5c9fe9`.

## ~~B004: Guest mode shows failure errors on all screens~~ (Resolved 2026-04-05)

**Severity:** High
**Resolution:** Feature 014 (Mobile Bug Bash) -- S002: Added `isTauri()` guard to `continueAsGuest()`. Commit `d5c9fe9`.

## ~~B005: App content overlaps Android system chrome~~ (Resolved 2026-04-05)

**Severity:** High
**Resolution:** Feature 014 (Mobile Bug Bash) -- S004/S005: Safe area insets plugin + CSS custom properties. Commit `d5c9fe9`.

## B006: Delete week doesn't work

**Added:** 2026-04-05
**Context:** Deleting a week in the program builder is not functioning correctly.
**Related:** Program builder, block weeks
**Priority:** Medium
