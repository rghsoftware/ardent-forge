# Bugs Backlog

Known bugs not blocking current work. Add entries via the backlog-add skill.
High-priority bugs should be addressed before starting new features.

<!-- Add new bugs below this line -->

## B001: invokeCommand does not log before re-throwing

**Severity:** High
**File:** `src/lib/tauri-adapter.ts:504-512`
**Rule violation:** `.claude/rules/error-handling.md` (Catch Blocks)
**Detail:** The `invokeCommand` catch block wraps errors in `AdapterError` and re-throws but never logs with `[tauri-adapter]` prefix. IPC failures are invisible in the dev console.
**Source:** PR #72 review finding P9-010
