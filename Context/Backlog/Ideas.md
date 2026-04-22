# Ideas Backlog

Ideas and enhancements for future consideration. Add entries via the backlog-add
skill. Prioritize via the backlog-prioritize skill.

<!-- Add new ideas below this line -->

## Move view-local modal state into StrengthWorkoutView (P22-014)

**Added:** 2026-04-20
**Source:** PR #115 review finding P22-014
**Priority:** Low

`showAddExercise`, `showDiscardDialog`, `pendingInputs`, and `restMinimized` (4 `useState` calls) are used exclusively inside `StrengthWorkoutView` but are held in the parent route because the extraction was a pure mechanical lift. Moving these into the component cuts the prop interface from ~44 to ~36 props and removes shared-state ownership with no behavioral change. Out of scope for the extraction PR -- do as a standalone refactor.

## ~~P17 Review: Adapter test coverage gaps (PR #107)~~ (Resolved 2026-04-15)

**Added:** 2026-04-12
**Source:** `Context/Reviews/0017-pr107-camelcase-conv-2026-04-12.md`
**Resolution:** All four items completed in PR #112.

| #       | File                                          | Improvement                                                                                                                                     | Status |
| ------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| P17-007 | `src/lib/__tests__/adapter-utils.test.ts`     | New file: unit tests for `camelizeKeys` and `parseJsonOrValue` -- already-camelCase passthrough, digit-adjacent keys, multiple/leading underscores, object passthrough, error on malformed JSON | Done   |
| P17-008 | `src/lib/__tests__/supabase-adapter.test.ts`  | Add `mapScheduledSession` malformed-JSON fallback test: fixture with bad JSON in `overrides`, assert `result.overrides === undefined` and `console.warn` called | Done   |
| P17-009 | `src/lib/__tests__/supabase-adapter.test.ts`  | Fix JSONB fixtures in `sessionTemplateRow` and `templateActivityRow` to pass pre-parsed objects (not `JSON.stringify`) to exercise the object-passthrough branch of `parseJsonOrValue` | Done   |
| P17-010 | `src/lib/__tests__/supabase-adapter.test.ts`  | Add `supports1RM` assertion to `getExercises` happy-path test (line 301); add fixture value and assert it round-trips correctly | Done   |

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

### ~~Browser notifications for rest timers and session reminders~~ (Resolved 2026-04-15)

**Added:** 2026-04-05
**Resolution:** Implemented in commit `926962e` (F022) -- browser rest timer and session reminder notifications shipped.

## ~~P9-011: Test for getUnreadCounts batching behavior~~ (Resolved 2026-04-04)

**Added:** 2026-04-04
**Source:** `Context/Reviews/0009-pr71-enhancement-batch-review.md`
**Resolution:** TauriAdapter.getUnreadCounts already has 2 unit tests (happy path + empty). The `Promise.allSettled` batching was a suggestion for SupabaseAdapter that was never implemented (still sequential loop). No further action needed; re-open if batching is implemented.

## ~~P11-012: Aggregated 1RM View~~ (Resolved 2026-04-22)

**Added:** 2026-04-05
**Source:** `Context/Reviews/0011-pr76-web-responsiveness-review.md` (P11-012)
**Resolution:** Restored aggregated 1RM view in Vault 1RM tab -- commit `7fd07f2`.

### ~~Overhaul web responsiveness for larger screens~~ (Resolved 2026-04-05)

**Added:** 2026-04-05
**Resolution:** Implemented in PR #76. Added max-width constraints, responsive padding, multi-column layouts across all authenticated pages.

### ~~Reorder nav items into logical groups~~ (Resolved 2026-04-05)

**Added:** 2026-04-05
**Resolution:** Reordered sidebar nav into logical groups: core tools, reference, social. Commit `1b359d2`.

### ~~Exercise completion signal during active workout~~ (Resolved 2026-04-22)

**Added:** 2026-04-12
**Resolution:** Implemented in PR #113 (F023) -- exercise completion signal shipped.

### ~~"Add exercise" pre-populated with frequently used exercises~~ (Resolved 2026-04-22)

**Added:** 2026-04-12
**Resolution:** Implemented in PR #114 (F024) -- frequent exercises add picker shipped.

### ~~P22-014: Move view-local modal state into StrengthWorkoutView~~ (Resolved 2026-04-22)

**Added:** 2026-04-21
**Resolution:** Implemented in commit `689548b` -- modal state encapsulated inside `StrengthWorkoutView`.

### ~~Split log.$workoutId route into three components~~ (Resolved 2026-04-21)

**Added:** 2026-04-06
**Resolution:** Implemented in PR #115 -- route split into `EventWorkoutView` and `StrengthWorkoutView` child components.
**Priority:** Medium
