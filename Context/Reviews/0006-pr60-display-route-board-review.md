# PR Review: worktree-feat+display-route-board -> develop

**Date:** 2026-04-04
**Feature:** Context/Features/009-display-route-board/
**Branch:** worktree-feat+display-route-board
**PR:** #60
**Reviewers:** code-reviewer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer, comment-analyzer
**Status:** :green_circle: Resolved

## Summary

18 findings across 26 files (2860 additions). 3 critical issues center on the reconnection
flow: `publishHello()` is dead code, channel objects leak on reconnect, and `boot()` has an
unhandled promise rejection. 7 important issues cover store robustness, untested reconnection
logic, and hidden-view timer waste. 8 suggestions for schema hardening, type deduplication,
and documentation accuracy.

**Breakdown:** 8 FIX, 4 TASK, 1 ADR, 1 RULE (plus 4 suggestions deferred to backlog)

## Findings

### Fix-Now

#### [FIX] P6-001: `publishHello()` never called after reconnection
- **File:** src/lib/display-subscriber.ts:100-118
- **Severity:** Critical
- **Detail:** Tech.md TD-5 requires publishing `display_hello` after reconnecting so phones
  re-broadcast their snapshots. `publishHello()` is implemented and exported but never wired
  into the reconnection flow. After reconnect, sessions only reappear when phones independently
  trigger new state changes. Violates requirement M8 and testable assertion TA-10.
- **Relates to:** Spec.md M8, Tech.md TD-5, TA-10
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `_hasConnectedBefore` flag; `publishHello()` called on SUBSCRIBED when reconnecting (not first connect)

#### [FIX] P6-002: Channel leak on reconnection -- dead channel not removed from Supabase client
- **File:** src/lib/display-subscriber.ts:109
- **Severity:** Critical
- **Detail:** On terminal status (`TIMED_OUT`, `CHANNEL_ERROR`, `CLOSED`), `_channel` is set
  to `null` without calling `_client.removeChannel(_channel)` first. The guard in
  `subscribeToDisplay` checks `_channel` which is already null, so the old channel is never
  cleaned up. Orphaned channel objects accumulate across reconnect cycles -- problematic for a
  long-running kiosk that may run for days.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Call `_client.removeChannel(_channel)` before nulling `_channel` in terminal status handler

#### [FIX] P6-003: Unhandled promise rejection in `boot()` causes blank screen
- **File:** src/routes/display.tsx:59-94
- **Severity:** Critical
- **Detail:** The `boot()` async function has no try-catch. If `resolveConfig()` throws
  (localStorage blocked in private browsing, network error in `validateConnection()`), or
  `createClient()` throws (malformed URL), the promise rejects silently. The display shows a
  blank page with zero feedback. A gym owner sees a black screen with no diagnostic info.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Wrapped `boot()` body in try-catch; sets connectionStatus to 'disconnected' on failure

#### [FIX] P6-004: `clearAllSessions` does not reset `currentPage`
- **File:** src/stores/display-store.ts (clearAllSessions action)
- **Severity:** High
- **Detail:** `clearAllSessions` resets `sessions`, `lastSeenAt`, and `focusedUserId` but not
  `currentPage`. If the display is on page 2 when all sessions clear, and new sessions arrive,
  `getPageSessions` returns an empty array because `currentPage` is still 2 but there is only
  1 page of content. Results in a blank board with active sessions.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `currentPage: 0` to `clearAllSessions` reset

#### [FIX] P6-005: `setCurrentPage` has no bounds clamping
- **File:** src/stores/display-store.ts (setCurrentPage action)
- **Severity:** Medium
- **Detail:** Accepts any number without validation. Setting `currentPage` to -1 or 999
  produces an empty `getPageSessions` result. The auto-paging interval in board-view.tsx
  could push the page beyond bounds if sessions are removed between ticks.
- **Status:** :white_check_mark: Fixed
- **Resolution:** `setCurrentPage` now clamps to `[0, totalPages-1]`; updated tests to verify bounds

#### [FIX] P6-006: `subscribeToDisplay` silently returns when client not initialized
- **File:** src/lib/display-subscriber.ts:53-57
- **Severity:** Medium
- **Detail:** When `_client` is null, the function logs `console.warn` and returns without
  notifying the caller via `onStatusChange`. The connection footer stays stuck on
  "Disconnected" with no reconnection attempts and no actionable feedback.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `handlers.onStatusChange('disconnected')` call before early return

#### [FIX] P6-007: `useElapsedTime` has no NaN guard for invalid timestamps
- **File:** src/hooks/use-elapsed-time.ts:11-12
- **Severity:** Medium
- **Detail:** `new Date(startedAt).getTime()` produces `NaN` if `startedAt` is an invalid
  string. While Zod validates upstream, this hook is exported publicly. `Math.floor(NaN / 1000)`
  produces `NaN`, rendering "NaN:NaN:NaN" on the gym TV.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `Number.isNaN(startMs)` guard returning 0; also clamped elapsed to `Math.max(0, ...)`

#### [FIX] P6-008: Stale comment in `__root.tsx` bypass list
- **File:** src/routes/__root.tsx:7
- **Severity:** Low
- **Detail:** Comment says "Allow /setup and public share routes to load without a backend
  configuration" but `/display` was just added to the bypass list. Comment no longer reflects
  the full set of bypassed routes.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Updated comment to include `/display` in the description

### Missing Tasks

#### [TASK] P6-009: Reconnection retry logic is entirely untested
- **File:** src/lib/display-subscriber.ts:105-118
- **Severity:** Critical
- **Detail:** The exponential backoff retry mechanism (delay computation, cap at 30s, retry
  attempt reset on success, cancel on destroy) has zero test coverage. This is the most complex
  untested code path in the PR and is architecturally central to the display's "set it and
  forget it" reliability requirement.
- **Relates to:** Spec.md M8, Tech.md TD-5
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S008 in Steps.md (Wave 4)

#### [TASK] P6-010: `use-elapsed-time.ts` has zero tests
- **File:** src/hooks/use-elapsed-time.ts
- **Severity:** Medium
- **Detail:** 19-line hook used by both `SessionCard` and `FocusedViewContent` with date
  arithmetic that could regress. Trivial to test with `renderHook` following the same pattern
  as `use-timer-interpolation.test.ts`. Test cases: returns 0 at start, increases over time,
  resets when `startedAt` changes, handles future timestamps.
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S009 in Steps.md (Wave 4)

#### [TASK] P6-011: Add `.min(1)` to string fields in display snapshot schema
- **File:** src/domain/types/display-snapshot.ts
- **Severity:** Medium
- **Detail:** `user_id`, `display_name`, `session_name`, and `current_exercise` accept empty
  strings. An empty `user_id` silently creates a session keyed to `""` in the store. Empty
  `display_name` / `session_name` produce blank cards on the TV.
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S010 in Steps.md (Wave 4)

#### [TASK] P6-012: Invalid payloads for `session_ended` and `focus` events not tested
- **File:** src/lib/__tests__/display-subscriber.test.ts
- **Severity:** Low
- **Detail:** Invalid `workout_snapshot` payload test exists, but `session_ended` and `focus`
  events have no invalid payload tests. These go through `userIdPayloadSchema.safeParse()` and
  should be dropped with a warning. A parameterized test for each would provide parity.
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S011 in Steps.md (Wave 4)

### Architectural Concerns

#### [ADR] P6-013: Dual-Map synchronization hazard in display store
- **File:** src/stores/display-store.ts
- **Severity:** High
- **Detail:** `sessions` and `lastSeenAt` are parallel Maps that must always have matching key
  sets. Every mutation must update both. A single missed spot creates a memory leak (orphaned
  `lastSeenAt` entries) or a crash (missing `lastSeenAt` for a session). Additionally, Zustand's
  `setState()` can bypass actions entirely. Merging into a single
  `Map<string, { snapshot: DisplaySnapshot; lastSeenAt: number }>` eliminates the invariant
  structurally.
- **Relates to:** Tech.md display store design
- **Status:** :white_check_mark: Fixed
- **Resolution:** Merged dual maps into single `Map<string, SessionEntry>`. No ADR needed -- straightforward refactor that eliminates the invariant structurally. Added `getSnapshot` and `getSessionCount` selectors for consumers.

### Convention Gaps

#### [RULE] P6-014: `ConnectionStatus` type defined in 3 separate places
- **Files:** src/stores/display-store.ts, src/lib/display-subscriber.ts (inline literals in
  DisplayEventHandlers.onStatusChange), subscriber status getter
- **Severity:** Medium
- **Detail:** The same `'connected' | 'disconnected' | 'reconnecting'` union is defined
  independently in three locations. These can drift without compile-time errors. Should be
  extracted to a single shared definition imported by both the store and subscriber.
- **Suggested rule:** Add to `.claude/rules/` or domain conventions: shared infrastructure
  types (connection status, event types) should be defined once and imported.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Extracted `DisplayConnectionStatus` type to `src/domain/types/display-snapshot.ts`; store and subscriber both import from the single source

### Deferred to Backlog (Suggestions)

The following are valid observations but lower priority. They can be captured as backlog
items rather than blocking merge:

- **S1:** Idle view components remain mounted with CSS opacity -- timers tick when hidden
  (src/routes/display.tsx:128-159). Consider conditional rendering or `visible` prop.
- **S2:** Reconnection retry has no max attempt limit -- infinite 30s retries with no "gave up"
  state (src/lib/display-subscriber.ts:111-118).
- **S3:** `publishHello` JSDoc says "presence" which is misleading given Supabase Presence API
  (src/lib/display-subscriber.ts:122).
- **S4:** `DisplayEventType` enum declared but never consumed programmatically
  (src/domain/types/display-snapshot.ts). Either consume it or remove it.

## Resolution Summary
**Resolved at:** 2026-04-04
**Session:** Review resolution for PR #60

| Category | Total | Fixed | Tasks Created | ADRs | Rules | Dismissed | Deferred |
|---|---|---|---|---|---|---|---|
| [FIX] | 8 | 8 | -- | -- | -- | -- | -- |
| [TASK] | 4 | -- | 4 | -- | -- | -- | -- |
| [ADR] | 1 | 1 | -- | -- | -- | -- | -- |
| [RULE] | 1 | 1 | -- | -- | 1 | -- | -- |
| **Total** | **14** | **10** | **4** | **0** | **1** | **0** | **0** |

Note: P6-013 (ADR) was resolved as a direct refactor (merged dual maps) rather than creating a formal ADR -- the fix was small enough to just do it.

## Resolution Checklist
- [x] All [FIX] findings resolved (P6-001 through P6-008)
- [x] All [TASK] findings added to Steps.md (P6-009 through P6-012)
- [x] All [ADR] findings have ADRs created or dismissed (P6-013)
- [x] All [RULE] findings applied or dismissed (P6-014)
- [x] Review verified by review-verify agent
