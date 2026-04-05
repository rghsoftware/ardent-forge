# Bugs Backlog

Known bugs not blocking current work. Add entries via the backlog-add skill.
High-priority bugs should be addressed before starting new features.

<!-- Add new bugs below this line -->

## ~~B001: invokeCommand does not log before re-throwing~~ (Resolved 2026-04-04)

**Severity:** High
**File:** `src/lib/tauri-adapter.ts:516`
**Resolution:** Added `console.error('[tauri-adapter] invokeCommand(${cmd}) failed:', e)` before the re-throw. All 140 tauri-adapter tests pass.
