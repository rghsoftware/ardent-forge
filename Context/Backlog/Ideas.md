# Ideas Backlog

Ideas and enhancements for future consideration. Add entries via the backlog-add
skill. Prioritize via the backlog-prioritize skill.

<!-- Add new ideas below this line -->

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

## P10 Review: Session builder type narrowing and test coverage

**Added:** 2026-04-05
**Source:** `Context/Reviews/0010-program-builder-ui-redesign-2026-04-05.md`
**Priority:** Medium

| #       | File(s)                      | Task                                                                                                                                              | Status         |
| ------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| P10-008 | `scheme-fields/*.tsx`        | Narrow `onChange` in all 12 scheme-fields to specific variant type (e.g., `SetScheme & { type: 'fixedSets' }`) to prevent cross-variant emissions | Done (f067a63) |
| P10-025 | `load-spec-editor.tsx`       | Add tests for `useEffect` auto-reset when load type becomes disallowed and `handleTypeChange` 7-branch defaults                                   | Done (cb9930a) |
| P10-026 | `duration-input.tsx`         | Add tests for compact/clearable mode `undefined` emission (currently mocked in session-template-form tests)                                       | Done (cb9930a) |
| P10-027 | `descending-reps-fields.tsx` | Add tests for rep ladder parsing edge cases: single number rejected, negatives filtered, comma+space splitting                                    | Done (cb9930a) |
| P10-028 | `set-scheme-editor.tsx`      | Add tests for `sessionCategory` prop filtering of visible scheme types and "Show all types" toggle                                                | Done (cb9930a) |
| P10-029 | `fixed-sets-fields.tsx`      | Add tests for range vs scalar branching (`typeof value.sets === 'object'`); existing test only covers the scalar path                             | Done (cb9930a) |

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
