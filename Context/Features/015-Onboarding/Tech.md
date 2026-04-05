# Tech Plan: New User Onboarding System

**Spec:** Context/Features/015-Onboarding/Spec.md
**Stacks involved:** React/TypeScript (frontend only)

## Architecture Overview

This feature adds three layers of onboarding infrastructure to the existing frontend. No backend changes are required -- all state is client-side.

**Layer 1: Empty State Consistency** -- a refactor pass that migrates ad-hoc inline empty states to the shared `<EmptyState>` component and fills gaps. No new architecture, just standardization.

**Layer 2: First-Run Welcome** -- a `WelcomeCard` component rendered on the Today page, gated by onboarding state. Three navigable paths (workout, exercises, builder) that dismiss permanently on interaction.

**Layer 3: Progressive Disclosure** -- an `<OnboardingHint>` component system for contextual callouts, feature discovery indicators on nav items, and guided hints during the first workout flow.

```
┌─────────────────────────────────────────────────────────┐
│              AuthenticatedLayout                         │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │  SidebarNav   │  │  <Outlet />                      │ │
│  │  (+ badges)   │  │                                  │ │
│  │               │  │  TodayPage                       │ │
│  │  Forge  ●     │  │  ┌────────────────────────────┐  │ │
│  │  Tracker      │  │  │  WelcomeCard (first-run)   │  │ │
│  │  Library ●    │  │  └────────────────────────────┘  │ │
│  │  Vault   ●    │  │  ┌────────────────────────────┐  │ │
│  │  Builder ●    │  │  │  GhostSessionPreview       │  │ │
│  │  ...          │  │  │  + EmptyState               │  │ │
│  │               │  │  └────────────────────────────┘  │ │
│  └──────────────┘  └──────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐│
│  │  MobileNav (+ badges)                                ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘

useOnboardingStore (Zustand + localStorage)
├── welcomeDismissed: boolean
├── hintsSeenKeys: Set<string>
├── visitedRoutes: Set<string>
└── firstWorkoutCompleted: boolean
```

## Key Decisions

### Decision 1: State Storage -- Zustand + Manual localStorage vs Zustand Persist Middleware

**Options considered:**

- **Option A: Zustand `create()` with manual `localStorage` calls** -- matches existing stores (`useBlockedUsersStore`). Manual `getItem/setItem` in each mutating action. userId-keyed storage key.
- **Option B: Zustand `persist` middleware** -- built-in serialization/deserialization, automatic sync, version migration support. No existing store in the project uses this.

**Chosen:** Option A -- Manual localStorage
**Rationale:** Every existing Zustand store in the project uses manual localStorage. Introducing `persist` middleware for one store adds a new pattern to learn and maintain. The onboarding store has a small, flat shape (4 fields) where manual persistence is trivial. userId-keyed storage ensures per-user onboarding state, matching the `blocked-users-store` precedent.

**ADR:** Context/Decisions/ADR-010-onboarding-state-local-storage.md

### Decision 2: Hint Component -- Custom vs Third-Party (Shepherd.js, React Joyride)

**Options considered:**

- **Option A: Custom `<OnboardingHint>` component** -- lightweight, fully controlled, follows Iron & Ember design system natively. No new dependency.
- **Option B: React Joyride or Shepherd.js** -- feature-rich tour libraries with spotlight/overlay, step sequencing, and positioning. Heavy dependencies (Joyride ~45KB, Shepherd ~60KB). Rounded corners and shadows baked into their default styling.

**Chosen:** Option A -- Custom component
**Rationale:** The spec explicitly excludes multi-step tours (W-1). We need standalone, non-modal hints that match Iron & Ember (zero border-radius, no shadows, tonal layering). A third-party library would require extensive style overrides to comply with the design system, and most of its features (spotlight dimming, step sequencing, scrolling) would go unused. A custom component is ~80 lines of JSX + a CSS class for positioning.

### Decision 3: Hint Positioning -- CSS-Only vs Floating UI

**Options considered:**

- **Option A: CSS-only positioning** -- hints rendered inline in the component tree, positioned via Tailwind utilities (absolute/relative). Simple, zero dependencies. Limited to hints adjacent to their target element.
- **Option B: Floating UI (`@floating-ui/react`)** -- precise anchoring to any DOM element with collision detection, flipping, and arrow placement. Already available as a transitive dependency via Radix UI.

**Chosen:** Option A -- CSS-only positioning
**Rationale:** All planned hint placements are inline within their parent component (e.g., above the exercise list, below the nav header, inside a vault tab). None require floating over unrelated UI or anchoring to arbitrary DOM elements. CSS-only positioning is simpler, SSR-compatible, and avoids a new direct dependency. If future hints need floating behavior, Floating UI can be added incrementally.

### Decision 4: Feature Discovery Indicators -- Where to Show

**Options considered:**

- **Option A: Both mobile bottom nav and desktop sidebar** -- consistent cross-platform experience.
- **Option B: Mobile only** -- mobile users have less screen to explore; desktop users can see the sidebar labels and are more likely to click around.
- **Option C: Neither** -- rely on the welcome card and page-level hints instead.

**Chosen:** Option A -- Both nav components
**Rationale:** The existing unread-count dot on the Comms nav item already establishes the pattern on both MobileNav and SidebarNav. Reusing the same dot pattern for feature discovery is zero additional UI complexity and creates visual consistency. The dot clears after first visit, so it has a short visible lifespan.

### Decision 5: Welcome Card Placement -- Replace vs Augment Ghost Preview

**Options considered:**

- **Option A: Replace GhostSessionPreview** -- the welcome card takes the full empty-state area. Ghost preview is removed for first-run users.
- **Option B: Augment** -- welcome card renders above the existing ghost preview + empty state text.

**Chosen:** Option B -- Augment (welcome card above ghost preview)
**Rationale:** The ghost preview demonstrates what the page will look like once populated, which is valuable context even for first-run users. The welcome card provides actionable orientation; the ghost preview provides visual promise. Together they answer "what should I do?" and "what will I see?" Once the welcome card is dismissed, the ghost preview remains as the standard empty state.

### Decision 6: First-Workout Hint Trigger -- Onboarding Store vs Query Data

**Options considered:**

- **Option A: Check `firstWorkoutCompleted` in onboarding store** -- hints show during any workout until the store flag is set on first completion.
- **Option B: Check workout count from query data** -- `useWorkoutLogs` with count check. More accurate but couples hints to server data availability.

**Chosen:** Option A -- Onboarding store flag
**Rationale:** The onboarding store is the single source of truth for all onboarding state. Using it avoids a dependency on query data being loaded (which has loading/error states). The flag is set when the first workout is completed (in the workout completion handler), ensuring hints show during the entire first workout, including if the user abandons and restarts.

## Stack-Specific Details

### React/TypeScript (`src/`)

**Files to create:**

- `src/stores/onboarding-store.ts` -- Zustand store with `welcomeDismissed`, `hintsSeenKeys`, `visitedRoutes`, `firstWorkoutCompleted`. Manual localStorage persistence, userId-keyed. Boundary validation per state-management conventions.
- `src/components/onboarding/welcome-card.tsx` -- First-run welcome card with three path buttons. Reads/writes onboarding store. Iron & Ember styled.
- `src/components/onboarding/onboarding-hint.tsx` -- Contextual hint component. Props: `hintKey`, `children` (the hint content), `position` (top/bottom). Auto-dismisses on close, checks `hintsSeenKeys` in store.
- `src/hooks/use-onboarding.ts` -- Convenience hook wrapping `useOnboardingStore` with derived helpers: `isFirstRun`, `shouldShowHint(key)`, `hasVisited(route)`, `markRouteVisited(route)`.

**Files to modify (empty state consistency):**

- `src/components/vault/vault-one-rm-tab.tsx` -- Add `<EmptyState>` when no 1RM exercises exist or when selected exercise has no history.
- `src/components/vault/vault-volume-tab.tsx` -- Replace inline empty state with `<EmptyState>`.
- `src/components/groups/group-detail.tsx` -- Replace plain micro-text for invites/members with `<EmptyState>`.
- `src/components/exercises/exercise-history-list.tsx` -- Already has icon+text; wrap in `<EmptyState>` and add CTA.
- `src/components/history/workout-detail-exercises.tsx` -- Wrap in `<EmptyState>`.
- `src/components/profile/one-rm-management.tsx` -- Already has icon+text; wrap in `<EmptyState>` and add CTA.
- `src/routes/_authenticated/exercises/index.tsx` -- Add CTA to unfiltered empty state.
- `src/routes/_authenticated/history/index.tsx` -- Replace inline empty with `<EmptyState>` + GhostSessionPreview.
- `src/routes/_authenticated/profile.tsx` -- Add first-visit hint for setting display name/units.
- `src/components/chat/conversation-list.tsx` -- Refactor `ConversationEmptyState` to use shared `<EmptyState>`.

**Files to modify (welcome card + hints):**

- `src/routes/_authenticated/index.tsx` -- Render `<WelcomeCard>` above ghost preview in the empty state block. Gate on `!welcomeDismissed`.
- `src/routes/_authenticated/library.tsx` -- Add `<OnboardingHint>` for first Library visit.
- `src/routes/_authenticated/vault.tsx` -- Add `<OnboardingHint>` for first Vault visit.
- `src/routes/_authenticated/builder.tsx` -- Add `<OnboardingHint>` for first Builder visit.

**Files to modify (nav badges):**

- `src/components/layout/mobile-nav.tsx` -- Add optional `badge` field to nav items array. Render discovery dot (reusing existing Comms dot pattern) when `useOnboarding().hasVisited(route)` is false.
- `src/components/layout/sidebar-nav.tsx` -- Same badge extension.

**Files to modify (first-workout hints):**

- `src/routes/_authenticated/log.$workoutId.tsx` -- Render `<OnboardingHint>` when exercise list is empty and `!firstWorkoutCompleted`. Render completion hint after first set logged.
- `src/components/workout/exercise-block.tsx` -- Render "Log your first set" hint above first SetRow when `!firstWorkoutCompleted` and no sets confirmed.

**Patterns to follow:**

- Empty states: `<EmptyState icon="" heading="" subtext="" action={} />` from `src/components/shared/empty-state.tsx`
- Store pattern: manual `localStorage.getItem/setItem` with userId-keyed key (see `src/stores/blocked-users-store.ts`)
- Component styling: Tailwind 4, `cn()` for conditional classes, Iron & Ember surfaces (`surface-pit`, `surface-iron`, `surface-charcoal`, `surface-gunmetal`, `surface-steel`)
- Error handling: `[module-name]` prefix logging per `.claude/rules/error-handling.md`
- TypeScript: strict mode, interfaces for props, Zod for store schema validation

## Integration Points

### Onboarding Store -> All Consumers

```
useOnboardingStore (Zustand)
  -> localStorage (userId-keyed persistence)
  -> useOnboarding() hook (derived helpers)
     -> WelcomeCard (reads welcomeDismissed, writes on dismiss)
     -> OnboardingHint (reads/writes hintsSeenKeys)
     -> MobileNav / SidebarNav (reads visitedRoutes)
     -> ActiveWorkoutPage (reads firstWorkoutCompleted)
```

### Route Visit Tracking

```
User navigates to /library
  -> AuthenticatedLayout renders <Outlet />
  -> Library route component mounts
  -> useEffect calls markRouteVisited('/library')
  -> Store updates visitedRoutes Set + persists to localStorage
  -> Nav badge for Library disappears reactively
```

### First Workout Completion

```
User completes first workout
  -> Workout completion handler (existing)
  -> Calls onboardingStore.markFirstWorkoutCompleted()
  -> Store updates flag + persists
  -> Future workouts: no more hints
```

## Risks & Unknowns

- **Risk:** localStorage is not available in some private browsing modes.
  - **Mitigation:** Wrap localStorage calls in try/catch. If unavailable, onboarding defaults to "not seen" on every session. Slightly annoying but not broken. Store boundary validation handles this.

- **Risk:** Hint positioning breaks on very small screens or unusual viewport sizes.
  - **Mitigation:** Hints are inline (CSS-only), not floating. They flow with content and respect Tailwind responsive breakpoints. Test on 320px width minimum.

- **Risk:** Onboarding hints interfere with the workout logging flow (gym-floor usability).
  - **Mitigation:** Workout hints are minimal (one line of text + dismiss), positioned above/below content (never overlaying input areas), and dismiss on first tap. The `isWorkoutRoute` guard in AuthenticatedLayout already suppresses nav -- onboarding respects this pattern.

- **Risk:** Users who signed up before this feature ships will see onboarding.
  - **Mitigation:** The store initializes from localStorage. Existing users will have no stored state, so they'll see hints as "new" features. This is acceptable -- the hints are brief and dismissable. The welcome card could optionally check `useWorkoutLogs` count > 0 to skip for users who already have history.

## Testing Strategy

- **Unit tests (`onboarding-store.test.ts`):** Initialize, dismiss welcome, mark hints seen, mark routes visited, mark first workout completed, persistence round-trip, boundary validation (invalid inputs rejected).
- **Component tests (`welcome-card.test.tsx`):** Renders when `welcomeDismissed` is false, each path button navigates correctly and calls dismiss, close button dismisses, does not render when `welcomeDismissed` is true.
- **Component tests (`onboarding-hint.test.tsx`):** Renders when hint key not in `hintsSeenKeys`, does not render when already seen, dismiss button marks key as seen, respects `prefers-reduced-motion`.
- **Integration/manual:** Full new-user flow from sign-up through first workout. Verify each hint appears once and only once. Verify welcome card dismissal persists. Verify nav badges clear on visit.
- **Visual:** All new components comply with Iron & Ember (no border-radius, no shadows, tonal surfaces, ember accent on primary CTAs only).
