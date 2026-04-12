# PR Review: chore/simplify-display-subsystem → main

**Date:** 2026-04-12
**Feature:** N/A (chore refactor — display subsystem, see `Context/Features/008-display-broadcast-infrastructure/`)
**Branch:** worktree-chore+simplify-display-subsystem
**PR:** #106 — `refactor(display): collapse publisher + subscriber into display-realtime`
**Reviewers:** pr-review-toolkit:code-reviewer, pr-review-toolkit:silent-failure-hunter, pr-review-toolkit:pr-test-analyzer
**Status:** ✅ Resolved

## Summary

16 findings across `src/lib/display-realtime.ts` (231 LOC) and `src/lib/__tests__/display-realtime.test.ts`
(391 LOC). The 15 import-path-only caller files are clean. Two critical runtime bugs (silent retry abandonment,
stale-closure ghost subscription), five high-severity error-handling gaps, and nine test coverage gaps.
Import path changes in the 15 caller files are correct.

## Findings

### Fix-Now

#### [FIX] P16-001: Silent retry abandonment leaves status stuck at `reconnecting`

- **File:** `src/lib/display-realtime.ts:156`
- **Severity:** Critical
- **Detail:** In `scheduleRetry`, the timeout callback checks `if (_client) subscribeToDisplay(...)` — when `_client` is null at fire time, the retry is silently skipped with no log and no status update. `_subStatus` stays `'reconnecting'` forever. This is reachable: `destroyDisplayPublisher` nulls `_client` when `!_subChannel` (line 141), and `_subChannel` is already null before the retry timer fires (nulled on line 198 before `scheduleRetry` is called). Fix: add `console.error` + `handlers.onStatusChange('disconnected')` in the null-client branch.
- **Status:** ✅ Fixed
- **Resolution:** Added `else` branch in `scheduleRetry` timeout: logs error, sets `_subStatus = 'disconnected'`, calls `handlers.onStatusChange('disconnected')`

#### [FIX] P16-002: `subscribeToDisplay` missing `clearTimeout` before re-subscribing

- **File:** `src/lib/display-realtime.ts:164`
- **Severity:** Critical
- **Detail:** If `subscribeToDisplay` is called again while a retry timer is pending (e.g., `useEffect` re-runs with a new `gymId`), the old timer is not cancelled. It fires, finds `_client` non-null, and calls `subscribeToDisplay` with the stale `gymId` captured in the closure — ghost-subscribing to the wrong gym's channel. Fix: add `if (_subRetryTimer !== null) { clearTimeout(_subRetryTimer); _subRetryTimer = null }` at the top of `subscribeToDisplay`, before the existing `_subChannel` cleanup.
- **Status:** ✅ Fixed
- **Resolution:** Added `clearTimeout(_subRetryTimer)` guard at the top of `subscribeToDisplay` before channel cleanup

#### [FIX] P16-004: `removeSafe` silently leaks channels when `_client` is null

- **File:** `src/lib/display-realtime.ts:30-37`
- **Severity:** High
- **Detail:** The `if (!client) return` early return swallows the channel without logging. The channel handle stays open from the SDK's perspective. This path is reachable during the `destroyDisplaySubscriber` → `destroyDisplayPublisher` interleave described in P16-001. Fix: `console.warn(`${L} removeSafe(${ctx}): client is null, channel may be leaked`)` before return.
- **Status:** ✅ Fixed
- **Resolution:** Added `console.warn` before the early return in `removeSafe` when client is null

#### [FIX] P16-005: `unfocus` handler bypasses `validated` with no try-catch

- **File:** `src/lib/display-realtime.ts:185`
- **Severity:** High
- **Detail:** All other broadcast event handlers go through `validated`. The `unfocus` handler calls `handlers.onUnfocus()` directly with no protection. A throwing handler propagates into Supabase's broadcast dispatch code. Fix: wrap in try-catch matching the publisher `display_hello` responder pattern at lines 63-68, or route through a no-schema `validated` variant.
- **Status:** ✅ Fixed
- **Resolution:** Wrapped `handlers.onUnfocus()` in try-catch with `console.error` on throw, matching the responder pattern

#### [FIX] P16-006: `CHANNEL_ERROR`/`TIMED_OUT` logged at `warn` not `error`

- **File:** `src/lib/display-realtime.ts:194`
- **Severity:** High
- **Detail:** The subscriber's status callback uses `console.warn` for all three error states. `CHANNEL_ERROR` and `TIMED_OUT` are network-level failures that take the display offline — they should log at `console.error`. `CLOSED` is an intentional teardown and is reasonably `console.info`. The publisher at line 72 already applies this distinction correctly. Fix: mirror the publisher's conditional: `(status === 'CLOSED' ? console.info : console.error)(...)`.
- **Status:** ✅ Fixed
- **Resolution:** Replaced `console.warn` with `(status === 'CLOSED' ? console.info : console.error)(...)` mirroring the publisher pattern

#### [FIX] P16-007: Empty `gymId` not validated — produces `display:gym:` channel name

- **File:** `src/lib/display-realtime.ts:97, 164`
- **Severity:** High
- **Detail:** `configureDisplayPublisher` and `subscribeToDisplay` validate `null` but not empty string. An empty string passes both guards and produces channel name `display:gym:` via `getGymChannelName("")`. `.claude/rules/state-management.md` explicitly flags this exact empty-string risk for this module. Fix: add `if (!gymId || gymId.trim() === '')` guards at both entry points.
- **Status:** ✅ Fixed
- **Resolution:** Added `gymId.trim() === ''` guard in `configureDisplayPublisher` (logs error, returns) and `subscribeToDisplay` (throws)

#### [FIX] P16-011: `validated` logs raw `ZodError` object — serializes poorly in aggregators

- **File:** `src/lib/display-realtime.ts:42`
- **Severity:** Medium
- **Detail:** `console.warn(`${L} Invalid ${ev} payload, dropping`, r.error)` passes the raw `ZodError` instance. In Sentry/Datadog this serializes as `[object Object]` or a truncated structure. Fix: use `r.error.toString()` and include the raw payload: `console.warn(`${L} Invalid ${ev} payload (dropping):`, r.error.toString(), p)`.
- **Status:** ✅ Fixed
- **Resolution:** Changed to `console.warn(..., r.error.toString(), p)` — includes stringified error and raw payload for aggregator context

#### [FIX] P16-014: Double-cast `snapshot as unknown as Record<string, unknown>`

- **File:** `src/lib/display-realtime.ts:115`
- **Severity:** Low
- **Detail:** `publishDisplaySnapshot` casts the typed `DisplaySnapshot` to `Record<string, unknown>` because `pubSend` requires that type. A cleaner approach: widen `pubSend`'s payload parameter to `unknown` since `channel.send()` accepts `unknown` internally.
- **Status:** ✅ Fixed
- **Resolution:** Widened `pubSend` parameter to `unknown` with a single internal cast at the `ch.send` call site; `publishDisplaySnapshot` now passes `snapshot` directly

---

### Missing Tasks

#### [TASK] P16-003: Missing test — `subscribeToDisplay` throw when uninitialized

- **File:** `src/lib/__tests__/display-realtime.test.ts`
- **Severity:** Critical
- **Detail:** `subscribeToDisplay` throws `Error` when `_client` is null (line 165-167). The calling route at `src/routes/display/gym/$gymId.tsx` relies on this contract to render the Retry button via its outer `try/catch` `BootError` mapping. This test existed in the deleted `display-subscriber.test.ts` and must be ported. Missing test: `'throws when subscribeToDisplay is called before initDisplaySubscriber'`.
- **Relates to:** `Context/Features/008-display-broadcast-infrastructure/`
- **Status:** ✅ Task created
- **Resolution:** Added as S015-T in Steps.md

#### [TASK] P16-008: Missing test — `onStatusChange` never asserted in subscriber tests

- **File:** `src/lib/__tests__/display-realtime.test.ts`
- **Severity:** Medium
- **Detail:** `createMockHandlers()` includes `onStatusChange: vi.fn()` but no test asserts it fires. The deleted subscriber test had parameterized cases for all three error statuses. Missing tests: `'calls onStatusChange("connected") on SUBSCRIBED'` and `'calls onStatusChange("reconnecting") for TIMED_OUT, CHANNEL_ERROR, and CLOSED'`.
- **Status:** ✅ Task created
- **Resolution:** Added as S017-T in Steps.md

#### [TASK] P16-009: Missing tests — `focus`, `unfocus`, `idle_snapshot` subscriber handlers

- **File:** `src/lib/__tests__/display-realtime.test.ts`
- **Severity:** Medium
- **Detail:** `subscribeToDisplay` registers five event handlers. The new test file covers `workout_snapshot` and `session_ended` only. Missing tests: `'fires onFocus when subscriber receives a focus broadcast'`, `'fires onUnfocus when subscriber receives an unfocus broadcast'`, `'fires onIdleSnapshot when subscriber receives a valid idle_snapshot broadcast'`. `idle_snapshot` is especially important — it uses `idleSnapshotSchema`, distinct from the others.
- **Status:** ✅ Task created
- **Resolution:** Added as S018-T in Steps.md

#### [TASK] P16-010: Missing test — gym-switch channel teardown/recreation

- **File:** `src/lib/__tests__/display-realtime.test.ts`
- **Severity:** Medium
- **Detail:** `configureDisplayPublisher` calls `teardownPubChannel()` when `gymId !== _pubGymId` (line 109). The deleted publisher test had a dedicated `'switching gyms between publishes'` block verifying `removeChannel` fires and the new gym gets its own channel. An athlete switching gyms mid-session could silently broadcast to the wrong display. Missing test: `'tears down the old channel and creates a new one when gymId changes via configureDisplayPublisher'`.
- **Status:** ✅ Task created
- **Resolution:** Added as S019-T in Steps.md

#### [TASK] P16-012: Missing test — exponential backoff sequencing

- **File:** `src/lib/__tests__/display-realtime.test.ts`
- **Severity:** Medium
- **Detail:** The `scheduleRetry` delay math (`Math.min(2000 * 2^attempt, 30_000)`) and `_subRetryAttempt` reset-on-reconnect are untested. Given gym-floor reliability requirements, silent backoff math regressions are high-cost. Missing tests: `'reconnects after CHANNEL_ERROR with backoff delay'`, `'resets retry attempt counter after successful reconnect'`, `'caps retry delay at 30 seconds'`.
- **Status:** ✅ Task created
- **Resolution:** Added as S020-T in Steps.md

#### [TASK] P16-013: Missing test — auto-publishHello on reconnect

- **File:** `src/lib/__tests__/display-realtime.test.ts`
- **Severity:** High
- **Detail:** The `_subConnectedBefore` flag (line 190) drives the guarantee that a reconnecting display automatically fires `publishHello()` so the gym board sees it come back online. No test exercises the full reconnect cycle: `SUBSCRIBED` → `CHANNEL_ERROR` → timer fires → `SUBSCRIBED` again → assert `display_hello` sent. Missing test: `'auto-fires publishHello on reconnect when previously connected'`.
- **Status:** ✅ Task created
- **Resolution:** Added as S016-T in Steps.md

#### [TASK] P16-016: Missing tests — `getActiveGymId` and `getSubscriberStatus` exported but untested

- **File:** `src/lib/__tests__/display-realtime.test.ts`
- **Severity:** Medium
- **Detail:** Both functions are exported and consumed by callers. The deleted `display-publisher.test.ts` had a full `getActiveGymId` describe block (null when unconfigured, returns ID when broadcasting, null after destroy). `getSubscriberStatus` was never tested. Missing tests: three `getActiveGymId` cases and three `getSubscriberStatus` state transition cases.
- **Status:** ✅ Task created
- **Resolution:** Added as S021-T in Steps.md

---

### Architectural Concerns

#### [ADR] P16-015: Shared `_client` teardown contract is implicit and asymmetric

- **File:** `src/lib/display-realtime.ts:141, 230`
- **Severity:** Medium
- **Detail:** `destroyDisplayPublisher` uses `!_subChannel` as proxy for "subscriber is idle" (line 141). `destroyDisplaySubscriber` uses `!_pubChannel && _pubGymId === null` (line 230). These are asymmetric and both use `_subChannel`/`_pubChannel` as proxies that are unreliable during the retry window (both are null while a retry timer is pending). The fundamental question: are publisher and subscriber designed to co-exist in the same browser context, or are they mutually exclusive? If mutually exclusive, a comment and assertion should document this. If they can co-exist, the guards need a more reliable sentinel (`_subActive` boolean set/cleared by `subscribeToDisplay`/`destroyDisplaySubscriber`).
- **Relates to:** `Context/Features/008-display-broadcast-infrastructure/Tech.md`
- **Status:** ✅ ADR created
- **Resolution:** ADR-015 — `Context/Decisions/ADR-015-display-realtime-shared-client-teardown.md`

---

## Resolution Checklist

- [x] All [FIX] findings resolved (P16-001, P16-002, P16-004, P16-005, P16-006, P16-007, P16-011, P16-014)
- [x] All [TASK] findings added to Steps.md or test file (P16-003, P16-008, P16-009, P16-010, P16-012, P16-013, P16-016)
- [x] All [ADR] findings have ADRs created or dismissed (P16-015)
- [x] All [RULE] findings applied or dismissed (none)
- [ ] Review verified by review-verify agent

## Resolution Summary

**Resolved at:** 2026-04-12
**Session:** resolve-review on worktree chore+simplify-display-subsystem

| Category  | Total  | Resolved |
| --------- | ------ | -------- |
| [FIX]     | 8      | 8        |
| [TASK]    | 7      | 7        |
| [ADR]     | 1      | 1        |
| [RULE]    | 0      | 0        |
| **Total** | **16** | **16**   |
