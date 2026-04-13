# Ideas Backlog

Ideas and enhancements for future consideration. Add entries via the backlog-add
skill. Prioritize via the backlog-prioritize skill.

<!-- Add new ideas below this line -->

## P17 Review: Adapter test coverage gaps (PR #107)

**Added:** 2026-04-12
**Source:** `Context/Reviews/0017-pr107-camelcase-conv-2026-04-12.md`
**Priority:** Medium

| #       | File                                          | Improvement                                                                                                                                     | Status |
| ------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| P17-007 | `src/lib/__tests__/adapter-utils.test.ts`     | New file: unit tests for `camelizeKeys` and `parseJsonOrValue` -- already-camelCase passthrough, digit-adjacent keys, multiple/leading underscores, object passthrough, error on malformed JSON | Open   |
| P17-008 | `src/lib/__tests__/supabase-adapter.test.ts`  | Add `mapScheduledSession` malformed-JSON fallback test: fixture with bad JSON in `overrides`, assert `result.overrides === undefined` and `console.warn` called | Open   |
| P17-009 | `src/lib/__tests__/supabase-adapter.test.ts`  | Fix JSONB fixtures in `sessionTemplateRow` and `templateActivityRow` to pass pre-parsed objects (not `JSON.stringify`) to exercise the object-passthrough branch of `parseJsonOrValue` | Open   |
| P17-010 | `src/lib/__tests__/supabase-adapter.test.ts`  | Add `supports1RM` assertion to `getExercises` happy-path test (line 301); add fixture value and assert it round-trips correctly | Open   |

## ~~Chat Data Layer Refinements (PR #33 review suggestions)~~ (Resolved 2026-04-05)

**Added:** 2026-04-02
**Updated:** 2026-04-04 -- S-1 through S-5 resolved in PR #71; S-6 partially addressed (error context added, N+1 remains)
**Source:** `Context/Reviews/0001-pr33-chat-data-layer-review.md` (S-1 through S-6)
**Priority:** Low

| #   | File               | Improvement                                                                                     | Status        |
| --- | ------------------ | ----------------------------------------------------------------------------------------------- | ------------- |
| S-1 | `conversation.ts`  | Add `.refine()` preventing `groupId` on direct conversations                                    | Done (PR #71) |
| S-2 | `message.ts`       | Add `.refine()` preventing `senderId` on system messages                                        | Done (PR #71) |
| S-3 | `media.ts`         | Add `.nonnegative()` to `durationSeconds` and `fileSizeBytes`                                   | Done (PR #71) |
| S-4 | `conversation.ts`  | Add temporal ordering refinement (`leftAt > joinedAt`)                                          | Done (PR #71) |
| S-5 | Supabase migration | CH-2 uniqueness trigger is O(N) per participant INSERT -- consider materialized lookup          | Done (PR #71) |
| S-6 | `tauri-adapter.ts` | `findDirectConversation` is N+1; error handling added (PR #71), batch requires new Rust command | Done          |

## ~~P10 Review: Session builder type narrowing and test coverage~~ (Resolved 2026-04-05)

**Added:** 2026-04-05
**Source:** `Context/Reviews/0010-program-builder-ui-redesign-2026-04-05.md`
**Resolution:** All 6 items completed -- type narrowing in `f067a63`, test coverage in `cb9930a`.

## ~~P9-010: Domain type tests for conversation, message, media~~ (Resolved 2026-04-04)

**Added:** 2026-04-04
**Source:** `Context/Reviews/0009-pr71-enhancement-batch-review.md`
**Resolution:** Created `src/domain/types/__tests__/chat.test.ts` with 18 tests covering all refinements (conversationSchema, conversationParticipantSchema, messageSchema, mediaAttachmentSchema). All pass.

### Browser notifications for rest timers and session reminders

**Added:** 2026-04-05
**Context:** Rest timer alerts and session reminders currently require the Tauri mobile app for native notifications. The web app should use the Web Notifications API (or Push API) so browser users get the same reminder experience without needing the native app.
**Related:** `src/components/profile/notification-settings.tsx`, rest timer system, session reminder scheduler
**Priority:** Medium

## ~~P9-011: Test for getUnreadCounts batching behavior~~ (Resolved 2026-04-04)

**Added:** 2026-04-04
**Source:** `Context/Reviews/0009-pr71-enhancement-batch-review.md`
**Resolution:** TauriAdapter.getUnreadCounts already has 2 unit tests (happy path + empty). The `Promise.allSettled` batching was a suggestion for SupabaseAdapter that was never implemented (still sequential loop). No further action needed; re-open if batching is implemented.

## Aggregated 1RM View

**Added:** 2026-04-05
**Source:** `Context/Reviews/0011-pr76-web-responsiveness-review.md` (P11-012)
**Priority:** Medium

The `OneRmManagement` component was removed from the profile page during the responsiveness overhaul. The per-exercise 1RM management is still accessible on each exercise detail page (`/exercises/$exerciseId`), but the aggregated cross-exercise 1RM view no longer exists. Consider adding an aggregated 1RM summary to the library exercises tab or a dedicated stats/progress page.

### ~~Overhaul web responsiveness for larger screens~~ (Resolved 2026-04-05)

**Added:** 2026-04-05
**Resolution:** Implemented in PR #76. Added max-width constraints, responsive padding, multi-column layouts across all authenticated pages.

### ~~Reorder nav items into logical groups~~ (Resolved 2026-04-05)

**Added:** 2026-04-05
**Resolution:** Reordered sidebar nav into logical groups: core tools, reference, social. Commit `1b359d2`.

### Exercise completion signal during active workout

**Added:** 2026-04-12
**Source:** User feedback
**Priority:** Medium

Two related UX gaps in the workout logger:

1. **"Done with this exercise" affordance** -- No explicit way to mark an exercise block as finished mid-workout. Users who finish squats before the planned sets are complete (injury, RPE ceiling, time) have no way to signal they're moving on. Options: a "Mark complete" button per exercise block, a long-press gesture, or a swipe action that collapses the block and flags it as done.

2. **Trailing auto-populated set ambiguity** -- When the logger auto-populates a new set row, it's unclear whether exiting the exercise (or ending the workout) will count that empty row as a logged set or discard it. Users are left guessing whether their volume is being over-counted. Need either: discard empty trailing sets on exit, or show explicit "incomplete set" vs "complete set" state that is visible before saving.

**Related:** `src/routes/_authenticated/log.$workoutId.tsx`, workout logger state, set auto-population logic
**Area:** Workout logger UX

### Split log.$workoutId route into three components
**Added:** 2026-04-06
**Context:** `src/routes/_authenticated/log.$workoutId.tsx` is ~800 lines with three distinct rendering paths (event workout, strength workout, post-workout summary) toggled by conditional branches. Splitting into separate route components would clarify ownership, shrink the file, and isolate state hoisting per path.
**Related:** `src/routes/_authenticated/log.$workoutId.tsx`
**Priority:** Medium
