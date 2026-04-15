# Bugs Backlog

Known bugs not blocking current work. Add entries via the backlog-add skill.
High-priority bugs should be addressed before starting new features.

<!-- Add new bugs below this line -->

## B009: `mapScheduledSession` overrides happy-path not covered by any test

**Severity:** Medium
**File:** `src/lib/__tests__/supabase-adapter.test.ts`
**Detail:** All existing fixtures set `overrides: null`, so the `if (r.overrides != null)` branch in
`mapScheduledSession` is never exercised by a green test. Neither the string-parse branch (Tauri/SQLite
path) nor the object-passthrough branch (Supabase PostgREST path) has coverage.
**Fix:** Add two tests -- one with `overrides: JSON.stringify({ ... })` asserting the parsed output, one with
a pre-parsed object asserting direct passthrough. Use a valid `SessionOverrides` fixture in each.
**Origin:** P19-003 (PR #112 review, 2026-04-15)

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

## ~~B006: Delete week doesn't work~~ (Resolved 2026-04-05)

**Severity:** Medium
**Resolution:** Fixed in `5d2335c` -- disable delete-week button when block has only one week.

### ~~B008: Gym selector shown every time a workout is started~~ (Resolved 2026-04-14)

**Severity:** Medium
**Resolution:** Fixed in PR #109 (gym picker fix -- last-selected gym now persisted across sessions).

### ~~B007: Active workout only shows one exercise despite multiple being added~~ (Resolved 2026-04-13)

**Added:** 2026-04-12
**Resolution:** Fixed in `11ca616` -- show all exercises simultaneously in active workout view.
