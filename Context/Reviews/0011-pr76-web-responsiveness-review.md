# PR Review: worktree-feat+overhaul-web-responsiveness -> develop

**Date:** 2026-04-05
**Feature:** N/A (standalone responsiveness overhaul)
**Branch:** worktree-feat+overhaul-web-responsiveness
**PR:** #76
**Reviewers:** code-reviewer, silent-failure-hunter, pr-test-analyzer, comment-analyzer
**Status:** :green_circle: Resolved

## Summary

22 findings across 14 source files: 2 critical, 4 high, 9 medium, 6 low, 1 convention gap. Includes 19 [FIX], 1 [TASK], 1 [RULE]. All suggestions triaged and captured.

## Findings

### Fix-Now

#### [FIX] P11-001: backend-settings tests broken by dialog refactor

- **File:** src/components/profile/**tests**/backend-settings.test.tsx
- **Severity:** Critical
- **Detail:** QR code and "Copy invite link" moved into a Dialog triggered by "Share this server", but 3 tests still expect these elements visible on render. Tests fail in CI. Need to click "Share this server" button before asserting on dialog contents.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Tests now click "Share this server" button before asserting on dialog contents (3 tests updated)

#### [FIX] P11-002: Silent guard clause in handleStartWorkout

- **File:** src/routes/\_authenticated/index.tsx:119
- **Severity:** Critical
- **Detail:** `if (!userId) return` with no logging or user-facing feedback. Primary CTA button does nothing if auth state is stale. Violates `.claude/rules/error-handling.md`. Compare with `handleStartProgrammedSession` (line 130) which correctly sets `startError`.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added console.error with [today-page] prefix and setStartError with user-facing message

#### [FIX] P11-003: 1RM save catch logs but no user-facing feedback

- **File:** src/routes/\_authenticated/exercises/$exerciseId.tsx:140-143
- **Severity:** High
- **Detail:** `console.error` added (good), but dialog stays open with no indication of failure. Comment on line 142 normalizes the gap by implying `isError` is the intended path, but no UI actually reads those error states. Need toast or dialog error state.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added oneRmError state for guard clause and catch block feedback; error now renders in dialog alongside mutation isError states; removed misleading comment

#### [FIX] P11-004: Profile save -- silent guard clause + catch with no user feedback

- **File:** src/routes/\_authenticated/profile.tsx:38,63-65
- **Severity:** High
- **Detail:** `handleSaveSettings` has bare `if (!profile) return` guard (no logging, no user state) and catch block that only logs. User gets zero feedback on save failure.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added console.error to guard, saveError state set in catch block, rendered alongside updateProfile.isError

#### [FIX] P11-005: Archive catch logs but no user-facing feedback

- **File:** src/components/chat/conversation-detail.tsx:109-111
- **Severity:** High
- **Detail:** `.catch((err) => { console.error('[chat] Archive failed:', err) })` -- user has no idea the archive operation failed. Need toast notification.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added toast('Failed to archive conversation. Please try again.') in catch block

#### [FIX] P11-006: Missing max-width wrapper on exerciseId early-return states

- **File:** src/routes/\_authenticated/exercises/$exerciseId.tsx:147-182
- **Severity:** Medium
- **Detail:** Loading, error, and not-found states lack `mx-auto max-w-5xl` wrapper while main content has it. Creates jarring width shift on wide screens when data loads. Compare with conversation-detail.tsx and group-detail.tsx which wrap consistently.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added mx-auto max-w-5xl wrapper to all three early-return states

#### [FIX] P11-007: Missing max-width wrapper on workoutId early-return states

- **File:** src/routes/\_authenticated/history/$workoutId.tsx:85-112
- **Severity:** Medium
- **Detail:** Same issue as P11-006. Error and not-found states lack the `mx-auto max-w-5xl` wrapper that main content views use.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added mx-auto max-w-5xl wrapper to error and not-found states

#### [FIX] P11-008: Virtualized history rows left-aligned on wide screens

- **File:** src/routes/\_authenticated/history/index.tsx:122-130
- **Severity:** Medium
- **Detail:** `position: absolute` + `left: 0` + `width: 100%` conflicts with `mx-auto` centering. On screens wider than 1024px, rows pin to left edge instead of centering. Need to apply max-width to an inner wrapper or use CSS centering on the absolute container.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added display:flex + justify-content:center to absolute container, moved max-w-5xl to an inner wrapper div

#### [FIX] P11-009: Font/color inconsistency in conversation-list error state

- **File:** src/components/chat/conversation-list.tsx:158
- **Severity:** Medium
- **Detail:** Uses `font-heading text-bone-white` while every other error state in the codebase uses `font-display text-warning-flare`. Doubly inconsistent.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Changed to font-display text-warning-flare to match codebase convention

#### [FIX] P11-010: Error and not-found conflated in conversation-detail

- **File:** src/components/chat/conversation-detail.tsx:142-147
- **Severity:** Medium
- **Detail:** `if (isError || !conversation)` always shows "Conversation not found" even on network errors. Misleading when the real problem is a fetch failure. Should split into two branches.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Split into separate isError (shows cloud_off + warning-flare) and !conversation (shows "not found") branches

#### [FIX] P11-011: exerciseId comment normalizes incomplete error handling

- **File:** src/routes/\_authenticated/exercises/$exerciseId.tsx:142
- **Severity:** Low
- **Detail:** Comment `// Error states available via saveOneRepMax.isError / updateProfile.isError` documents an incomplete error strategy as intentional. Should be a TODO or replaced with actual user feedback. Will be addressed alongside P11-003.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Comment removed; replaced with actual error state feedback (oneRmError) as part of P11-003 fix

### Missing Tasks

#### [TASK] P11-012: Clarify OneRmManagement removal from profile page

- **File:** src/routes/\_authenticated/profile.tsx
- **Severity:** High
- **Detail:** The `OneRmManagement` component import was removed and the entire "CURRENT MAXES" section was deleted. This was the only aggregated view of 1RM across exercises. If intentional, document in PR description or backlog. If not, restore and relocate to a column in the new grid layout.
- **Relates to:** Profile page overhaul
- **Status:** :white_check_mark: Task created
- **Resolution:** Added to Context/Backlog/Ideas.md as "Aggregated 1RM View" (Medium priority). Per-exercise 1RM remains on exercise detail pages.

#### [FIX] P11-013: TodayPage query hooks missing isError handling

- **File:** src/routes/\_authenticated/index.tsx:78-85
- **Severity:** Medium
- **Detail:** `useWorkoutLogs`, `useActiveProgram`, `useProgramFull`, `useNextUpcomingEvent` all lack `isError` destructuring. Silently shows empty/stale data on fetch failure. Violates `.claude/rules/error-handling.md` query hook rule.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added isError destructuring to all four hooks with hasDataError aggregate banner

#### [FIX] P11-014: library.tsx error destructured but never rendered

- **File:** src/routes/\_authenticated/library.tsx:66
- **Severity:** Medium
- **Detail:** Templates query destructures `error` but never references it in JSX. Templates tab shows empty content on fetch failure with no explanation.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Already handled -- error IS rendered at line 223-229 with icon and message. Finding was inaccurate.

#### [FIX] P11-015: Block/unblock fire-and-forget with no error handling

- **File:** src/components/chat/conversation-detail.tsx:90-101
- **Severity:** Medium
- **Detail:** `blockUser()` and `unblockUser()` called without awaiting or catching errors. Dialog closes immediately regardless of success/failure. User believes block succeeded when it may not have.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added try/catch with console.error and toast notifications for both block and unblock actions

#### [FIX] P11-016: exerciseId guard clause logs but no user-facing error state

- **File:** src/routes/\_authenticated/exercises/$exerciseId.tsx:106-109
- **Severity:** Medium
- **Detail:** `if (!userId)` guard correctly logs with `[exercises]` prefix but does not set any form error or toast. Dialog stays open with submit button appearing functional.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Guard now sets oneRmError state which renders in the dialog form

#### [FIX] P11-017: Restore ghost preview comment in history/index.tsx

- **File:** src/routes/\_authenticated/history/index.tsx
- **Severity:** Low
- **Detail:** `{/* Ghost preview: mirrors real history row layout */}` was removed but explained design intent not obvious from the component name alone. Restore for maintainability.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Comment restored above GhostSessionPreview usage

#### [FIX] P11-018: Consider "native app" over "mobile app" in notification copy

- **File:** src/components/profile/notification-settings.tsx:183
- **Severity:** Low
- **Detail:** "Session reminders require the mobile app" -- Tauri targets both mobile and desktop. "Native app" is more durable if desktop Tauri build ships. Aligns with project direction without being platform-specific.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Changed copy from "mobile app" to "native app"

#### [FIX] P11-019: Expand two-column layout comment

- **File:** src/routes/\_authenticated/index.tsx:176
- **Severity:** Low
- **Detail:** Comment explains the conditional grid but not why the else-branch is `undefined` (no grid wrapper needed for empty/program-only state). Brief expansion prevents future "fix" attempts.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Expanded comment to explain why single-column case uses no grid wrapper

#### [FIX] P11-020: Add skeleton layout divergence note in profile

- **File:** src/routes/\_authenticated/profile.tsx:83
- **Severity:** Low
- **Detail:** Skeleton uses `md:grid-cols-2` at all breakpoints while real content uses `lg:grid-cols-3`. Add comment: `{/* Simplified 2-col skeleton -- full 3-col layout loads with content */}` to prevent "fix" attempts.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added clarifying comment above skeleton grid

#### [FIX] P11-021: Retain section-level labels alongside column comments in profile

- **File:** src/routes/\_authenticated/profile.tsx
- **Severity:** Low
- **Detail:** Section comments (`{/* SETTINGS section */}`, etc.) were replaced by column comments (`{/* Column 1: ... */}`). Column comments describe layout grouping while section comments describe content. Retaining both aids navigation in a long file.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added section-level comments (SETTINGS, ACCOUNT, BACKEND, REMOTE DISPLAY, NOTIFICATIONS) alongside column comments

### Convention Gaps

#### [RULE] P11-022: Document max-w-5xl as standard content-width token

- **Files:** All 14 source files in this PR
- **Severity:** Low
- **Detail:** `max-w-5xl` (1024px) is applied as the content-width constraint across every authenticated page but the rationale is not documented anywhere. Future maintainers may use inconsistent values.
- **Suggested rule:** Add to `.claude/rules/` a layout conventions file, or document in one canonical component: `/* max-w-5xl (1024px) is the standard content width for all authenticated pages to prevent excessive line lengths on wide screens */`
- **Status:** :white_check_mark: Rule updated
- **Resolution:** Created .claude/rules/layout-conventions.md documenting max-w-5xl as standard content width and responsive padding pattern

## Resolution Summary

**Resolved at:** 2026-04-05
**Session:** PR #76 web responsiveness review resolution

| Category  | Total  | Resolved |
| --------- | ------ | -------- |
| [FIX]     | 19     | 19       |
| [TASK]    | 1      | 1        |
| [ADR]     | 0      | 0        |
| [RULE]    | 1      | 1        |
| **Total** | **21** | **21**   |

**Notes:**

- P11-014 was already handled in existing code (error IS rendered at library.tsx:223-229); finding was inaccurate
- P11-012 (OneRmManagement removal) added to backlog as aggregated 1RM view idea

## Resolution Checklist

- [x] All [FIX] findings resolved
- [x] All [TASK] findings addressed
- [x] Suggestions triaged
- [x] All [RULE] findings applied or dismissed
- [x] Review verified by review-verify agent
