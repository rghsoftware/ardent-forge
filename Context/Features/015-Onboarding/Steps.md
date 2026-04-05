# Implementation Steps: New User Onboarding System

**Spec:** Context/Features/015-Onboarding/Spec.md
**Tech:** Context/Features/015-Onboarding/Tech.md

## Progress

- **Status:** Complete
- **Current task:** Done
- **Last milestone:** Feature complete -- all assertions verified

## Team Orchestration

### Team Members

- **foundation-eng**
  - Role: Onboarding store, hook, and shared EmptyState enhancements
  - Agent Type: general-purpose
  - Resume: false
- **empty-state-eng**
  - Role: Standardize empty states across all pages and components
  - Agent Type: general-purpose
  - Resume: false
- **onboarding-ui-eng**
  - Role: Welcome card, hint component, page-level hint placements
  - Agent Type: general-purpose
  - Resume: false
- **nav-eng**
  - Role: Feature discovery indicators on mobile and sidebar nav
  - Agent Type: general-purpose
  - Resume: false
- **workout-hint-eng**
  - Role: First-workout guided hints in the logging flow
  - Agent Type: general-purpose
  - Resume: false
- **validator**
  - Role: Quality validation (read-only)
  - Agent Type: quality-engineer
  - Resume: false

## Tasks

### Phase 1: Foundation -- Store, Hook, and EmptyState Component

- [ ] S001: Create `src/stores/onboarding-store.ts` -- Zustand store with manual localStorage persistence. Shape: `{ welcomeDismissed: boolean, hintsSeenKeys: string[], visitedRoutes: string[], firstWorkoutCompleted: boolean }`. Actions: `dismissWelcome()`, `markHintSeen(key: string)`, `markRouteVisited(route: string)`, `markFirstWorkoutCompleted()`, `resetOnboarding()`, `initialize(userId: string)`. Storage key pattern: `onboarding-state-${userId}`. Boundary validation: reject empty userId, validate stored JSON shape on load (fall back to defaults on corruption). Wrap all localStorage calls in try/catch per ADR-010.
  - **Assigned:** foundation-eng
  - **Depends:** none
  - **Parallel:** true

- [ ] S001-T: Test onboarding store -- initialize with userId creates default state, dismissWelcome persists, markHintSeen adds key and persists, markRouteVisited adds route, markFirstWorkoutCompleted sets flag, resetOnboarding clears all state, initialize with corrupted localStorage falls back to defaults, empty userId is rejected.
  - **Assigned:** foundation-eng
  - **Depends:** S001
  - **Parallel:** false

- [ ] S002: Create `src/hooks/use-onboarding.ts` -- convenience hook wrapping `useOnboardingStore`. Exports: `useOnboarding()` returning `{ isFirstRun, shouldShowHint(key), hasVisited(route), dismissWelcome, markHintSeen, markRouteVisited, markFirstWorkoutCompleted, resetOnboarding }`. `isFirstRun` is true when `!welcomeDismissed`. `shouldShowHint(key)` returns true when key is not in `hintsSeenKeys`. `hasVisited(route)` checks `visitedRoutes`. Hook calls `initialize(userId)` on mount using userId from `useAuth()`.
  - **Assigned:** foundation-eng
  - **Depends:** S001
  - **Parallel:** false

- [ ] S003: Review shared `<EmptyState>` component at `src/components/shared/empty-state.tsx`. Verify it supports all needed props: `icon`, `heading`, `subtext`, `action` (ReactNode), `className`. If the `Icon` component import path or prop interface needs adjustment for the standardization pass, update now. Ensure the component is exported from a barrel if one exists for `shared/`.
  - **Assigned:** foundation-eng
  - **Depends:** none
  - **Parallel:** true

��� MILESTONE: Phase 1 complete -- Onboarding store and hook ready, EmptyState component verified.
**Contracts:**

- `src/stores/onboarding-store.ts` -- useOnboardingStore with all actions
- `src/hooks/use-onboarding.ts` -- useOnboarding() hook with derived helpers
- `src/components/shared/empty-state.tsx` -- EmptyState component verified and ready

### Phase 2: Empty State Consistency Pass

- [ ] S004: Standardize vault empty states. (a) `src/components/vault/vault-one-rm-tab.tsx` -- add `<EmptyState icon="monitoring" heading="No 1RM data yet" subtext="Log a strength session to see trends here." />` when `oneRmExercises.length === 0` (no exercises with 1RM support), and when a specific exercise is selected but has no history. (b) `src/components/vault/vault-volume-tab.tsx` -- replace inline empty state (exercise selected, no data) with `<EmptyState icon="bar_chart" heading="No volume history for this exercise" subtext="Log sessions with this exercise to see volume trends." />`.
  - **Assigned:** empty-state-eng
  - **Depends:** S003
  - **Parallel:** true

- [ ] S005: Standardize group detail empty states. `src/components/groups/group-detail.tsx` -- replace plain micro-text for invites sub-section with `<EmptyState icon="mail" heading="No active invites" subtext="Create an invite to add members to this group." />`. Replace members micro-text with `<EmptyState icon="group" heading="No members yet" subtext="Invite connections to join this group." />`. Use compact sizing (smaller padding) to fit within sub-sections.
  - **Assigned:** empty-state-eng
  - **Depends:** S003
  - **Parallel:** true

- [ ] S006: Standardize exercise-related empty states. (a) `src/components/exercises/exercise-history-list.tsx` -- wrap existing icon+text in `<EmptyState>`, add a CTA: "Log a session" button or link. (b) `src/components/history/workout-detail-exercises.tsx` -- wrap in `<EmptyState>`. (c) `src/components/profile/one-rm-management.tsx` -- wrap in `<EmptyState>`, add descriptive subtext. (d) `src/routes/_authenticated/exercises/index.tsx` -- add subtext to unfiltered empty state explaining exercises appear after first workout.
  - **Assigned:** empty-state-eng
  - **Depends:** S003
  - **Parallel:** true

- [ ] S007: Standardize remaining empty states. (a) `src/routes/_authenticated/history/index.tsx` -- replace inline empty state text/link with `<EmptyState>` while keeping `<GhostSessionPreview>` above it. (b) `src/routes/_authenticated/profile.tsx` -- add a first-visit info callout (not a full empty state, but a subtle hint) suggesting the user set their display name and preferred units. (c) `src/components/chat/conversation-list.tsx` -- refactor `ConversationEmptyState` to use shared `<EmptyState>` with `icon="chat"` while preserving the "Start conversation" CTA button.
  - **Assigned:** empty-state-eng
  - **Depends:** S003
  - **Parallel:** true

🏁 MILESTONE: Phase 2 complete -- All empty states standardized. Verify A-001 through A-004.
**Contracts:**

- Every authenticated page with a "no data" state uses `<EmptyState>`
- Vault 1RM tab, group detail, profile all have proper empty states

### Phase 3: Welcome Card and Onboarding Hint Component

- [ ] S008: Create `src/components/onboarding/onboarding-hint.tsx` -- `<OnboardingHint>` component. Props: `hintKey: string`, `children: ReactNode` (hint content), `position?: 'above' | 'below'` (default 'above'), `className?: string`. Behavior: reads `shouldShowHint(hintKey)` from `useOnboarding()`. If already seen, renders nothing. Otherwise renders a tonal callout (`bg-surface-gunmetal` with `border-l-2 border-ember`) containing `children` and a dismiss button (X icon, 48px touch target). On dismiss, calls `markHintSeen(hintKey)`. Animate entry with a brief opacity fade, gated by `prefers-reduced-motion` media query. Iron & Ember compliant: zero border-radius, no box shadows, tonal layering.
  - **Assigned:** onboarding-ui-eng
  - **Depends:** S002
  - **Parallel:** true

- [ ] S008-T: Test OnboardingHint -- renders when hint key not seen, does not render when already seen, dismiss button calls markHintSeen, respects prefers-reduced-motion (no animation class when motion-reduce).
  - **Assigned:** onboarding-ui-eng
  - **Depends:** S008
  - **Parallel:** false

- [ ] S009: Create `src/components/onboarding/welcome-card.tsx` -- `<WelcomeCard>` component. No props (reads state internally from `useOnboarding()`). Renders when `isFirstRun` is true. Content: heading "Welcome to Ardent Forge" (mixed-case, font-heading), subtext "Choose where to start.", three path buttons arranged vertically: (a) "Log a workout" with `fitness_center` icon, navigates to `/` and triggers `handleStartWorkout`, (b) "Browse exercises" with `exercise` icon, navigates to `/exercises`, (c) "Build a program" with `build` icon, navigates to `/builder`. Each button calls `dismissWelcome()` then navigates. A close/dismiss button (X) in the top-right corner also calls `dismissWelcome()`. Styling: `bg-surface-iron` card with ember left border accent (`border-l-2 border-ember`), 48px+ touch targets on all buttons, zero border-radius.
  - **Assigned:** onboarding-ui-eng
  - **Depends:** S002
  - **Parallel:** true

- [ ] S009-T: Test WelcomeCard -- renders when isFirstRun true, does not render when welcomeDismissed, each path button navigates correctly and calls dismissWelcome, close button dismisses without navigation.
  - **Assigned:** onboarding-ui-eng
  - **Depends:** S009
  - **Parallel:** false

- [ ] S010: Integrate welcome card into Today page. `src/routes/_authenticated/index.tsx` -- import `<WelcomeCard>`, render it inside the empty-state block (where `completedWorkouts.length === 0 && !hasActiveProgram`) above `<GhostSessionPreview>`. The welcome card manages its own visibility via `useOnboarding()`. Also: import `useOnboarding()` and call `markRouteVisited('/')` in a `useEffect` on mount.
  - **Assigned:** onboarding-ui-eng
  - **Depends:** S009
  - **Parallel:** false

- [ ] S011: Place page-level onboarding hints. (a) `src/routes/_authenticated/library.tsx` -- add `<OnboardingHint hintKey="library-intro">` with text like "Your templates and programs live here. Create a session template to start building." Render above the tab content. Call `markRouteVisited('/library')` on mount. (b) `src/routes/_authenticated/vault.tsx` -- add `<OnboardingHint hintKey="vault-intro">` with text like "Your training analytics will appear here as you log sessions." Call `markRouteVisited('/vault')` on mount. (c) `src/routes/_authenticated/builder.tsx` -- add `<OnboardingHint hintKey="builder-intro">` with text like "Design your training program here. Add blocks, assign sessions to days, and set your progression." Call `markRouteVisited('/builder')` on mount.
  - **Assigned:** onboarding-ui-eng
  - **Depends:** S008, S010
  - **Parallel:** false

🏁 MILESTONE: Phase 3 complete -- Welcome card and page hints functional. Verify A-005 through A-010.
**Contracts:**

- `src/components/onboarding/onboarding-hint.tsx` -- OnboardingHint component
- `src/components/onboarding/welcome-card.tsx` -- WelcomeCard component
- Page-level hints on Library, Vault, Builder
- Route visit tracking on Today, Library, Vault, Builder

### Phase 4: Navigation Discovery Indicators

- [ ] S012: Add feature discovery dots to mobile nav. `src/components/layout/mobile-nav.tsx` -- import `useOnboarding()`. For each nav item, check `hasVisited(item.to)`. If not visited, render a discovery dot (small ember-colored square, matching the existing Comms unread dot pattern but using `bg-ember/60` to differentiate from notification dots). Skip the dot for the home route `/` (always "visited" since it's the landing page). Skip the dot for Comms (already has its own unread indicator).
  - **Assigned:** nav-eng
  - **Depends:** S002
  - **Parallel:** true

- [ ] S013: Add feature discovery dots to sidebar nav. `src/components/layout/sidebar-nav.tsx` -- same logic as S012. Apply the discovery dot in both expanded and collapsed sidebar states. Skip home and Comms routes.
  - **Assigned:** nav-eng
  - **Depends:** S002
  - **Parallel:** true

- [ ] S014: Wire route visit tracking for remaining pages. Add `markRouteVisited` calls in `useEffect` on mount for: `src/routes/_authenticated/history/index.tsx` (`/history`), `src/routes/_authenticated/connections.tsx` (`/connections`), `src/routes/_authenticated/groups.tsx` (`/groups`), `src/routes/_authenticated/exercises/index.tsx` (`/exercises`). These calls clear the nav discovery dot for each page on first visit.
  - **Assigned:** nav-eng
  - **Depends:** S002
  - **Parallel:** true

🏁 MILESTONE: Phase 4 complete -- Nav discovery indicators functional. Verify A-015.
**Contracts:**

- MobileNav and SidebarNav render discovery dots for unvisited routes
- All authenticated routes call markRouteVisited on mount

### Phase 5: First-Workout Guided Hints

- [ ] S015: Add first-workout hints to the workout logging page. `src/routes/_authenticated/log.$workoutId.tsx` -- import `useOnboarding()`. (a) When `loggedGroups.length === 0` and `!firstWorkoutCompleted`, render `<OnboardingHint hintKey="workout-add-exercise">` above the "Add exercise" button with text: "Tap below to add your first exercise." (b) After workout completion (in the existing completion handler), call `markFirstWorkoutCompleted()`.
  - **Assigned:** workout-hint-eng
  - **Depends:** S008, S002
  - **Parallel:** true

- [ ] S016: Add "log your first set" hint to exercise block. `src/components/workout/exercise-block.tsx` -- import `useOnboarding()`. When `!firstWorkoutCompleted` and no sets are confirmed yet (all sets have `confirmed: false`), render `<OnboardingHint hintKey="workout-first-set">` above the first SetRow with text: "Enter weight and reps, then confirm your set."
  - **Assigned:** workout-hint-eng
  - **Depends:** S008, S002
  - **Parallel:** true

- [ ] S017: Add workout completion celebration hint. After the first workout is completed (detected by the `markFirstWorkoutCompleted` call in S015), render a brief one-time hint in the `WorkoutSummary` component or the Today page on return: `<OnboardingHint hintKey="workout-complete-celebration">` with text: "First session logged. Your history and analytics are now building." This is the "aha moment" -- the user's data lifecycle begins.
  - **Assigned:** workout-hint-eng
  - **Depends:** S015
  - **Parallel:** false

���� MILESTONE: Phase 5 complete -- First-workout guided flow functional. Verify A-011 through A-014.
**Contracts:**

- Workout page renders contextual hints during first workout
- First workout completion flag persists, preventing future hints

### Phase 6: Polish and Settings

- [ ] S018: Add "Reset onboarding" option to Profile page. `src/routes/_authenticated/profile.tsx` -- add a button in the settings section that calls `resetOnboarding()` from `useOnboarding()`. Label: "Reset onboarding hints". Confirm with a brief toast: "Onboarding reset. You'll see guided hints again." Style as a subtle text button, not a primary action.
  - **Assigned:** onboarding-ui-eng
  - **Depends:** S002
  - **Parallel:** true

- [ ] S019: Skip welcome card for existing users. In `<WelcomeCard>`, add an additional gate: if `useWorkoutLogs(userId, 1)` returns data with length > 0, treat as an existing user and do not show the welcome card (call `dismissWelcome()` silently). This prevents users who signed up before this feature from seeing the welcome card when they already have workout history.
  - **Assigned:** onboarding-ui-eng
  - **Depends:** S009
  - **Parallel:** true

🏁 MILESTONE: Phase 6 complete -- Polish done. Verify A-016.

### Phase 7: Validation

- [ ] S020: Full feature validation -- read-only inspection of all modified/created files against Spec.md testable assertions A-001 through A-019. Verify: all empty states use `<EmptyState>`, welcome card lifecycle, hint lifecycle, nav discovery indicators, first-workout hints, design system compliance (zero border-radius, no shadows, tonal layering, ember accent restraint, 48px touch targets), `prefers-reduced-motion` support.
  - **Assigned:** validator
  - **Depends:** S017, S018, S019, S014
  - **Parallel:** false

🏁 MILESTONE: Feature complete -- all assertions verified.

## Acceptance Criteria

- [ ] All testable assertions from Spec.md verified (A-001 through A-019)
- [ ] All tests passing (`bun run test`)
- [ ] No TODO/FIXME stubs remaining
- [ ] TypeScript compiles cleanly (`bun run build`)
- [ ] Lint passes (`bun run lint`)

## Validation Commands

```bash
bun run build        # TypeScript check + Vite build
bun run test         # Vitest (all tests)
bun run lint         # ESLint
```
