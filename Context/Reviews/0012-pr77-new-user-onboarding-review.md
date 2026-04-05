# PR Review: feat/new-user-onboarding -> develop

**Date:** 2026-04-05
**Feature:** Context/Features/015-Onboarding/
**Branch:** feat/new-user-onboarding
**PR:** #77
**Reviewers:** code-reviewer, test-analyzer, silent-failure-hunter, comment-analyzer, type-design-analyzer
**Status:** :green_circle: Resolved

## Summary

19 findings total across 55 changed files (+2153/-146). 2 critical fixes (render-phase side effect, missing query error handling), 3 missing tasks (domain types, hook tests, auto-dismiss test), 14 fix-now items ranging from convention violations to comment accuracy. No architectural concerns or convention gaps warranting new rules -- the existing conventions are adequate, the code just needs to follow them more consistently.

## Findings

### Fix-Now

#### [FIX] P12-001: Render-phase side effect in `useOnboarding` hook

- **File:** src/hooks/use-onboarding.ts:18
- **Severity:** Critical
- **Detail:** `initialize(userId)` is called unconditionally during render. This triggers `localStorage.getItem` + `JSON.parse` + Zustand `set()` during React's render phase, violating `.claude/rules/state-management.md`. Cascading effects: calls `initialize('')` on every unauthenticated render (console.warn spam), auto-dismiss effect in WelcomeCard may fire before store is ready, discovery dots flash for returning users during auth loading.
- **Fix:** Move to `useEffect`: `useEffect(() => { if (userId) initialize(userId) }, [userId, initialize])`
- **Status:** :white_check_mark: Fixed
- **Resolution:** Wrapped `initialize(userId)` in `useEffect` with `userId` guard

#### [FIX] P12-002: `WelcomeCard` ignores `isError` from `useWorkoutLogs` query

- **File:** src/components/onboarding/welcome-card.tsx:31
- **Severity:** Critical
- **Detail:** When the query fails, `workoutLogs` is `undefined`, `hasExistingWorkouts` becomes `false`, and a returning user with workout history sees the welcome card. Violates `.claude/rules/error-handling.md` (query hook error states). Network failures silently result in showing onboarding to a returning user.
- **Fix:** Destructure `isError` and suppress the card on failure: `if (!isFirstRun || hasExistingWorkouts || isError) return null`
- **Status:** :white_check_mark: Fixed
- **Resolution:** Destructured `isError` from `useWorkoutLogs` and added to early-return guard

#### [FIX] P12-003: Profile hint doesn't use `<OnboardingHint>` component

- **File:** src/routes/\_authenticated/profile.tsx:127-133
- **Severity:** High
- **Detail:** Custom inline hint that checks `!profile.displayName` instead of using `<OnboardingHint>`. Not dismissable, not tracked in `hintsSeenKeys`, cannot be reset via "Reset onboarding hints". Inconsistent with all other hints in the feature.
- **Fix:** Wrap in `<OnboardingHint hintKey="profile-display-name">` or document as intentional deviation.
- **Relates to:** Spec M-7 (hints track seen state per key)
- **Status:** :white_check_mark: Fixed
- **Resolution:** Replaced inline hint with `<OnboardingHint hintKey="profile-display-name">`

#### [FIX] P12-007: Some empty states don't use shared `<EmptyState>` component

- **Files:** src/components/exercises/one-rm-chart.tsx:22-28, src/components/program-builder/block-list.tsx:114, src/components/program-builder/mobile-block-editor.tsx:109
- **Severity:** Medium
- **Detail:** These build empty state layouts inline rather than using the shared `<EmptyState>` component that the rest of the PR standardizes on. Inconsistent with Spec M-1.
- **Relates to:** Spec M-1 (all empty states use shared component)
- **Status:** :white_check_mark: Fixed
- **Resolution:** Replaced all three inline empty states with `<EmptyState>` component

#### [FIX] P12-008: `SKIP_DISCOVERY_ROUTES` duplicated in both nav components

- **Files:** src/components/layout/mobile-nav.tsx:16, src/components/layout/sidebar-nav.tsx:22
- **Severity:** Medium
- **Detail:** Identical `Set` defined in two files. Should be a shared constant to prevent drift.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Extracted to `src/components/layout/nav-constants.ts`, imported by both nav components

#### [FIX] P12-009: Tech.md diagram says `Set<string>` but implementation uses `string[]`

- **File:** Context/Features/015-Onboarding/Tech.md
- **Severity:** Medium
- **Detail:** Architecture diagram documents store shape as `hintsSeenKeys: Set<string>` and `visitedRoutes: Set<string>`. Actual implementation uses `string[]` arrays with `.includes()` for lookups. Misleading for future developers.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Updated Tech.md diagram to show `string[]` matching implementation

#### [FIX] P12-010: `seed-display.ts` JSDoc says "2-5" but actual range is 1-5

- **File:** scripts/seed-display.ts:9
- **Severity:** Low
- **Detail:** Comment says `board - Sends 2-5 workout_snapshot events` but the actual range is 1-5 (default 3, parameterized via CLI argument). No lower bound of 2 exists.
- **Fix:** Change to `board - Sends N workout_snapshot events (board view, default 3, max 5)`
- **Status:** :white_check_mark: Fixed
- **Resolution:** Updated JSDoc to accurately describe parameterized range

#### [FIX] P12-014: `shouldShowHint` mock doesn't verify `hintKey` argument

- **File:** src/components/onboarding/**tests**/onboarding-hint.test.tsx:12
- **Severity:** Low
- **Detail:** Mock `shouldShowHint: () => mockShouldShowHint` ignores its argument. Test would pass even if the component called `shouldShowHint('wrong-key')`. Should be `vi.fn(() => mockShouldShowHint)` so tests can assert correct `hintKey`.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Changed mock to `vi.fn(() => mockShouldShowHint)` for argument tracking

#### [FIX] P12-015: Repetitive state snapshot in store mutators

- **File:** src/stores/onboarding-store.ts (lines 97-164)
- **Severity:** Low
- **Detail:** Every mutation method (`dismissWelcome`, `markHintSeen`, `markRouteVisited`, `markFirstWorkoutCompleted`) manually destructures and reconstructs the full `OnboardingState` for `persistState`. 4 near-identical code blocks. A `snapshotState()` helper would reduce duplication and risk of a field being missed.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `snapshotState(get)` helper, refactored all 4 mutators to use it

#### [FIX] P12-016: Nav components use `useOnboarding()` instead of direct store selector

- **Files:** src/components/layout/mobile-nav.tsx:19, src/components/layout/sidebar-nav.tsx:48
- **Severity:** Low
- **Detail:** Both nav components call `useOnboarding()` which internally calls `useAuth()` and `initialize()` on every render. For nav, only `visitedRoutes` is needed. Using `useOnboardingStore((s) => s.visitedRoutes)` directly avoids unnecessary auth lookup and initialize call on every route change.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Replaced `useOnboarding()` with `useOnboardingStore((s) => s.visitedRoutes)` in both nav components

#### [FIX] P12-017: Missing file-level JSDoc on `onboarding-store.ts`

- **File:** src/stores/onboarding-store.ts
- **Severity:** Low
- **Detail:** New file introducing an entire subsystem has no file-level comment explaining purpose, localStorage keying strategy, or relationship to ADR-010. Has good section dividers but no top-level overview.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added file-level JSDoc explaining purpose, persistence strategy, and ADR-010 reference

#### [FIX] P12-018: New `eslint-disable` comments lack inline explanations

- **Files:** src/components/chat/message-list.tsx:231, src/routes/\_authenticated/exercises/$exerciseId.tsx:103, src/routes/\_authenticated/history/index.tsx:57
- **Severity:** Low
- **Detail:** Three new `// eslint-disable-next-line react-hooks/incompatible-library` suppressions for TanStack Virtual and React Hook Form hooks. None explain why the suppression is safe. Should add brief rationale (e.g., `-- useVirtualizer manages its own deps`).
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added inline rationale to all three eslint-disable comments

#### [FIX] P12-019: Redundant JSX section comments

- **Files:** src/components/onboarding/welcome-card.tsx:54,64,71; src/components/workout/exercise-block.tsx:43,88
- **Severity:** Low
- **Detail:** Comments like `{/* Close button */}`, `{/* Content */}`, `{/* Path buttons */}`, `{/* Exercise name header */}`, `{/* Set rows */}` restate what is already obvious from the JSX immediately below. Low-value "what" comments.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Removed 5 redundant JSX section comments from welcome-card.tsx and exercise-block.tsx

### Missing Tasks

#### [TASK] P12-004: Define `OnboardingHintKey` and `OnboardingRoute` union types

- **File:** src/domain/types/ (new file needed), src/stores/onboarding-store.ts:12-13, src/hooks/use-onboarding.ts:22-23, src/components/onboarding/onboarding-hint.tsx:7
- **Severity:** High
- **Detail:** `hintsSeenKeys: string[]` and `visitedRoutes: string[]` accept arbitrary strings. The codebase uses exactly 6 hint keys and 8 route strings. A typo like `markHintSeen("libary-intro")` silently fails. Per TypeScript conventions, domain-keyed types must use unions, not `string`. Type-analyzer scored invariant expression at 3/10 due to this gap.
- **Relates to:** `.claude/rules/typescript-conventions.md` (domain-keyed Record types)
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S021 in Steps.md

#### [TASK] P12-005: Add `useOnboarding` hook tests

- **File:** src/hooks/**tests**/use-onboarding.test.ts (new file needed)
- **Severity:** High
- **Detail:** Zero test coverage on the central integration point between auth, store, and every consuming component. Needs `renderHook` tests for: (a) `initialize` called with user ID, (b) re-renders with same user don't re-initialize, (c) `isFirstRun`/`shouldShowHint`/`hasVisited` return correct values, (d) behavior when `user` is null.
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S022-T in Steps.md

#### [TASK] P12-006: Add WelcomeCard auto-dismiss test for existing users

- **File:** src/components/onboarding/**tests**/welcome-card.test.tsx
- **Severity:** High
- **Detail:** No test case where `useWorkoutLogs` returns non-empty data. The silent dismiss path for pre-existing users (the `useEffect` at line 36-39) is production-critical but unverified. Need a test that mocks non-empty workout data, verifies the card does not render, and verifies `dismissWelcome` is called.
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S023-T in Steps.md

#### [TASK] P12-011: Test mutation guards when called before `initialize`

- **File:** src/stores/**tests**/onboarding-store.test.ts
- **Severity:** Medium
- **Detail:** Every mutation has a `!currentUserId` guard that logs a warning and returns early. Only `initialize('')` is tested. Need a test that calls each method on a fresh store and asserts state remains default and `console.warn` fires.
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S024-T in Steps.md

#### [TASK] P12-012: Test `persistState` failure path

- **File:** src/stores/**tests**/onboarding-store.test.ts
- **Severity:** Medium
- **Detail:** `persistState` has a `catch` that logs the error, but no test verifies this. Mock `localStorage.setItem` to throw, call a mutation, verify in-memory state still updates and error is logged.
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S025-T in Steps.md

#### [TASK] P12-013: Test user-switching state isolation

- **File:** src/stores/**tests**/onboarding-store.test.ts
- **Severity:** Medium
- **Detail:** No test for initializing with user-A, making changes, then initializing with user-B. Multi-account scenario from ADR-010. Verify user-B gets defaults, then re-initializing user-A loads persisted state.
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S026-T in Steps.md

### Architectural Concerns

_None identified._

### Convention Gaps

_None identified. Existing conventions in `.claude/rules/` are adequate -- the findings are about following them, not missing rules._

## Resolution Checklist

- [x] All [FIX] findings resolved (13 items)
- [x] All [TASK] findings added to Steps.md (6 items)
- [x] All [ADR] findings have ADRs created or dismissed (0 items)
- [x] All [RULE] findings applied or dismissed (0 items)
- [ ] Review verified by review-verify agent

## Resolution Summary

**Resolved at:** 2026-04-05
**Session:** PR #77 review resolution -- onboarding feature fixes and task creation

| Category  | Total  | Resolved |
| --------- | ------ | -------- |
| [FIX]     | 13     | 13       |
| [TASK]    | 6      | 6        |
| [ADR]     | 0      | 0        |
| [RULE]    | 0      | 0        |
| **Total** | **19** | **19**   |
