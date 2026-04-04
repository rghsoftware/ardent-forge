# PR Review: feat/idle-mode -> develop

**Date:** 2026-04-04
**Feature:** Context/Features/009-idle-mode/
**Branch:** worktree-feat+idle-mode
**Reviewers:** code-reviewer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer, comment-analyzer
**Status:** :green_circle: Resolved

## Summary

16 findings across 20 changed files (~1700 lines). 3 critical (clock drift bug, silent null client on /display, lying connection status), 6 important (path matching, duplicate channel, missing CLOSED handling, production logging, duplicate type, unsafe cast), 4 task gaps (missing tests, schema edge cases), 3 convention/comment cleanup items. The Edge Function and SQL migration are solid; frontend error handling and observability are the main concerns.

## Findings

### Fix-Now

#### [FIX] P6-001: Clock re-sync block computes increasingly wrong offset from stale prop
- **File:** src/components/display/clock-display.tsx:29-37
- **Severity:** Critical
- **Detail:** The 60-tick re-sync inside `setInterval` re-parses the same stale `serverTimeCorrection` string against an advancing `Date.now()`, making `offsetRef.current` drift progressively negative. The first `useEffect` (lines 14-20) already correctly resets the offset when the prop changes. The re-sync block is redundant and introduces drift. The accompanying comment ("NTP corrections and DST transitions") is misleading.
- **Relates to:** A-001 (clock accuracy), A-013 (long-running stability), S-3 (drift correction)
- **Status:** :white_check_mark: Fixed
- **Resolution:** Removed the 60-tick re-sync block and misleading NTP/DST comment from clock-display.tsx

#### [FIX] P6-002: `/display` route silently non-functional when Supabase client not initialized
- **File:** src/components/display/use-idle-snapshot.ts:19-20
- **Severity:** Critical
- **Detail:** The `/display` route bypasses the auth/config guard in `__root.tsx`, but `getSupabaseClient()` depends on that initialization. On a fresh visit to `/display` (no prior app visit), the client is always `null`. The hook silently returns without logging. Combined with P6-003, the display shows a clock, says "Connected", and never receives data -- with zero signal anything is wrong.
- **Relates to:** A-004 (sessions render on idle_state), A-009 (Edge Function publishes every 60s)
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added console.error when Supabase client is null in useIdleSnapshot

#### [FIX] P6-003: Connection status defaults to "Connected" when no connection exists
- **File:** src/routes/display.tsx:30-39
- **Severity:** Critical
- **Detail:** Initial state is `'connected'`, but if the Supabase client is null the subscription effect returns early without updating state. The footer permanently displays "Connected" with no actual Realtime connection. This actively misleads the operator.
- **Relates to:** A-013 (hours of stable operation)
- **Status:** :white_check_mark: Fixed
- **Resolution:** Default connectionStatus changed to 'reconnecting'; status now driven by useIdleSnapshot callback

#### [FIX] P6-004: Path bypass in `__root.tsx` too broad -- matches `/display*`
- **File:** src/routes/__root.tsx:11
- **Severity:** High
- **Detail:** `startsWith('/display')` matches `/display-anything`, `/displayfoo`, etc. The existing `/s/` bypass uses a trailing slash for precision.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Changed to exact match `location.pathname === '/display'` in __root.tsx

#### [FIX] P6-005: Duplicate `display-status` channel wastes a subscription
- **File:** src/routes/display.tsx:42-54
- **Severity:** High
- **Detail:** A separate `display-status` channel is created solely for connection monitoring. `useIdleSnapshot` already subscribes to the real `display` channel. Two separate channels; the status one never receives broadcasts, so its status only reflects WebSocket health of a purposeless channel.
- **Relates to:** A-013 (no resource leaks)
- **Status:** :white_check_mark: Fixed
- **Resolution:** Removed duplicate display-status channel; useIdleSnapshot now accepts onConnectionStatus callback and reports channel status from the real display channel

#### [FIX] P6-006: `CLOSED` channel status not handled
- **File:** src/routes/display.tsx:42-48
- **Severity:** Medium
- **Detail:** Subscription callback only handles `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`. Supabase also emits `CLOSED` (network drops, server restarts). Over hours of operation, missed `CLOSED` events leave the status indicator stuck.
- **Relates to:** A-013 (hours of stable operation)
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added CLOSED to the reconnecting branch in useIdleSnapshot subscribe callback

#### [FIX] P6-007: Invalid payloads silently discarded in production
- **File:** src/components/display/use-idle-snapshot.ts:25-29
- **Severity:** High
- **Detail:** `safeParse` failures only log in dev mode (`import.meta.env.DEV`). In production, schema drift between Edge Function and frontend produces zero signal -- the display just shows a bare clock forever.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Changed from DEV-only console.warn to unconditional console.error for validation failures

#### [FIX] P6-008: Duplicate `DisplayMode` type definition
- **File:** src/components/display/use-display-mode.ts:4, src/components/display/display-mode-transition.tsx:3
- **Severity:** Medium
- **Detail:** `type DisplayMode = 'idle' | 'board' | 'focused'` defined independently in two files. Adding a mode to one but not the other produces a silent mismatch.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Created src/components/display/types.ts with shared DisplayMode type; both files import from there

#### [FIX] P6-009: Unsafe type cast of RPC result in Edge Function
- **File:** supabase/functions/display-idle-snapshot/index.ts:65
- **Severity:** Medium
- **Detail:** `as ScheduledSession[]` cast with no shape validation. Column renames in the SQL function would produce `undefined` fields that the frontend Zod schema rejects silently (see P6-007).
- **Status:** :white_check_mark: Fixed
- **Resolution:** Replaced unsafe `as` cast with runtime .filter() that validates all four string fields before including a row

#### [FIX] P6-010: Remove redundant "what" comments
- **File:** src/routes/display.tsx:25,28,30-31,37; src/components/display/idle-view.tsx:23,29,53,64
- **Severity:** Low
- **Detail:** ~8 comments that restate what self-documenting code already says (e.g., `// Idle snapshot from Edge Function broadcast` above `const idleSnapshot = useIdleSnapshot()`). Remove or replace with "why" comments where the architectural choice is non-obvious (e.g., why a separate display-status channel exists).
- **Status:** :white_check_mark: Fixed
- **Resolution:** Removed 8 redundant "what" comments from display.tsx and idle-view.tsx

### Missing Tasks

#### [TASK] P6-011: Add tests for `useIdleSnapshot` hook
- **File:** src/components/display/use-idle-snapshot.ts
- **Severity:** High
- **Detail:** Zero test coverage for the hook with the most real async/channel logic. Needs tests for: valid payload updates state, invalid payload discarded (state stays null), null client returns null without throwing, `removeChannel` called on unmount, subscription status handling.
- **Relates to:** A-004, A-013 (memory leaks / cleanup)
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S011 in Steps.md Phase 5

#### [TASK] P6-012: Add tests for `DisplayModeTransition`
- **File:** src/components/display/display-mode-transition.tsx
- **Severity:** Medium
- **Detail:** `getTransitionClasses` contains branching logic mapping mode transitions to CSS classes (300ms vs 400ms, zoom-in-95). Pure function that directly implements A-007 and A-017. No tests.
- **Relates to:** A-007 (300ms idle-to-board), A-017 (400ms board-to-focused)
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S012 in Steps.md Phase 5

#### [TASK] P6-013: Add schema edge case tests
- **File:** src/domain/types/__tests__/display-snapshot.test.ts
- **Severity:** Low
- **Detail:** Missing tests for: invalid session_type value (e.g., "YOGA"), empty scheduled_sessions array, invalid ISO date string for server_time. These catch Zod schema regressions at the parse boundary.
- **Relates to:** A-010 (payload structure)
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S013 in Steps.md Phase 5

#### [TASK] P6-014: Strengthen ClockDisplay server correction test assertion
- **File:** src/components/display/__tests__/clock-display.test.tsx:62-76
- **Severity:** Low
- **Detail:** Test only asserts time is "different" after correction (`not.toBe(initialTime)`), not that it matches the expected corrected value. Would pass even with wrong-sign correction.
- **Relates to:** A-001 (clock accuracy), S-3 (drift correction)
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S014 in Steps.md Phase 5

### Architectural Concerns

_None identified. The architecture follows established patterns and the feature is well-scoped._

### Convention Gaps

#### [RULE] P6-015: String fields in display schemas should have `.min(1)`
- **Files:** src/domain/types/display-snapshot.ts
- **Severity:** Medium
- **Detail:** `display_name`, `session_name`, `day_label` accept empty strings via `z.string()`. For display-facing types rendered as visible text on a TV, empty values produce blank cards. Adding `.min(1)` catches this at parse time.
- **Suggested rule:** Add to `.claude/rules/` domain types conventions: "Display-facing string fields must use `.min(1)` to prevent blank UI elements"
- **Status:** :white_check_mark: Rule applied
- **Resolution:** Added .min(1) to all display-facing string fields in idleSnapshotSchema (display_name, session_name, day_label in both scheduled_sessions and next_session)

#### [RULE] P6-016: Tech.md D4 documents wrong option as chosen
- **Files:** Context/Features/009-idle-mode/Tech.md (D4 section)
- **Severity:** Low
- **Detail:** Tech.md D4 documents "Option (a) Raw SQL JOIN traversal in Edge Function" as the chosen approach, but implementation uses `supabase.rpc('get_display_idle_sessions')` -- an RPC function (Option c). Documentation is stale.
- **Suggested rule:** N/A -- one-off documentation fix
- **Status:** :white_check_mark: Fixed
- **Resolution:** Updated Tech.md D4 to document Option (c) RPC as the chosen approach

## Resolution Checklist
- [x] All [FIX] findings resolved (10 items)
- [x] All [TASK] findings added to Steps.md (4 items)
- [x] All [ADR] findings have ADRs created or dismissed (0 items)
- [x] All [RULE] findings applied or dismissed (2 items)
- [ ] Review verified by review-verify agent

## Resolution Summary
**Resolved at:** 2026-04-04
**Session:** Resolve idle mode PR review findings

| Category | Total | Fixed | Tasks Created | ADRs | Rules | Dismissed | Deferred |
|---|---|---|---|---|---|---|---|
| [FIX] | 10 | 10 | -- | -- | -- | -- | -- |
| [TASK] | 4 | -- | 4 | -- | -- | -- | -- |
| [ADR] | 0 | -- | -- | 0 | -- | -- | -- |
| [RULE] | 2 | 1 | -- | -- | 1 | -- | -- |
| **Total** | **16** | **10** | **4** | **0** | **1** | **0** | **0** |
