# Tech Plan: Pause-Gated Finish

**Spec:** Context/Features/019-Pause-Gated-Finish/Spec.md
**Stacks involved:** React 19 / TypeScript (UI only)

## Architecture Overview

This is a UI-only refactor. No schema changes, no store changes, no new state. The pause state machine added in Feature 018 (`pausedAt`, `totalPausedMs`, `isPaused`) is reused as-is — this feature only changes which actions are surfaced in which paused state.

The change has three moving parts:

1. **`WorkoutHeader`** loses its FINISH button. Its action cluster shrinks to: `[cast slot] [pause/play toggle]`. The `onFinish`, `isFinishing`, `canFinish` props are removed from `WorkoutHeader`.
2. **A new `WorkoutPausedBar` component** is introduced. It renders a sticky bar containing three peer actions: `Resume`, `Finish`, `Discard`. It receives all the props the header used to handle finish/discard plus the helper-text gating data.
3. **`log.$workoutId.tsx`** wraps `WorkoutHeader` and `WorkoutPausedBar` in a single `sticky top-0 z-50` container so they scroll-pin together. The two existing standalone Discard render blocks (one per branch) and the global "LOG A SET TO FINISH" helper line are deleted; their responsibilities move into `WorkoutPausedBar`.

The render shape becomes:

```
<div class="sticky top-0 z-50">
  <WorkoutHeader … />               // always visible: timer + pause + cast
  {isPaused && <WorkoutPausedBar … />}  // appears only when paused
</div>
```

## Key Decisions

### D-1: Component split — extract `WorkoutPausedBar` rather than overload `WorkoutHeader`

**Options considered:**

1. Keep everything inside `WorkoutHeader`. Add an internal `isPaused` branch that swaps the action cluster contents.
2. **Extract a separate `WorkoutPausedBar` component** rendered alongside `WorkoutHeader` from the route.
3. Make `WorkoutHeader` a compound component (`WorkoutHeader.Active` + `WorkoutHeader.Paused`) co-located in the same file.

**Chosen:** Option 2.
**Rationale:** The active header and the paused bar have different jobs: the active header is a quiet status surface (timer + pause + cast); the paused bar is a decision surface (resume + finish + discard + helper text). They have non-overlapping props, different visual treatments, and should be testable in isolation. Keeping them as separate sibling components also makes the route's render tree honest about what's happening — "header is always visible, paused bar is conditional" — instead of hiding the conditional inside `WorkoutHeader`. Option 3 (compound) buys colocation but adds indirection without the props simplification of Option 2.

**Related ADRs:** None. Feature 018 introduced `WorkoutHeader`; this evolves it within established conventions.

### D-2: Sticky stacking — single wrapper, not two stacked sticky elements

**Options considered:**

1. Mark both `WorkoutHeader` and `WorkoutPausedBar` as `sticky top-0` and rely on CSS stacking. Each manages its own sticky offset.
2. **Wrap both in a single non-component `<div className="sticky top-0 z-50">` at the route level.** The wrapper is the sticky element; the children flow normally inside it.
3. Render the paused bar as `fixed` below a known header height.

**Chosen:** Option 2.
**Rationale:** Two sibling sticky elements at `top-0` collapse onto each other (the second one stops sticking once the first one is unstuck) and create offset math we don't want. A single sticky wrapper makes both elements behave as one block: they scroll together when above the fold, pin together when scrolled past. Option 3 (`fixed`) requires hardcoding the header height and breaks if the header layout ever changes. The wrapper approach is the existing pattern used elsewhere in the codebase for the active workout header.

**Related ADRs:** None.

### D-3: `WorkoutPausedBar` props shape

The new component takes everything it needs to render the action cluster and helper text:

```typescript
interface WorkoutPausedBarProps {
  onResume: () => void
  onFinish: () => void
  isFinishing: boolean
  canFinish: boolean
  onDiscard: () => void
  showFinishHelper: boolean // true when canFinish is false on a path that supports
  // helper text (strength); false on event path
}
```

`canFinish` and `showFinishHelper` are passed as separate props rather than derived because the event path always passes `canFinish={true}` and never wants helper text, while the strength path computes both from `confirmedSetCount`. Keeping them as inputs lets the bar stay branch-agnostic.

**Related ADRs:** None.

### D-4: Helper text copy and placement

**Decision:** Helper renders inline in the paused bar, immediately to the left of the disabled Finish button, in the badge typography lane (`text-[11px] uppercase tracking-widest text-warm-ash/60`). Copy: `"Log a set before finishing"` — past-tense imperative matches the moment the user is in (they're already paused, deciding what to do next).

**Rationale:** Co-locating the helper with the disabled affordance is the standard accessibility pattern (label adjacent to the disabled control it explains). Moving it from the global header into the paused bar means it's only seen by users who actually encounter the friction, which is the fix the spec asked for.

The helper does NOT receive `aria-describedby` linkage on this iteration; the visual proximity is sufficient and the disabled state itself is announced by screen readers via the button's `disabled` attribute. Can revisit if accessibility audit flags it.

### D-5: Visual hierarchy of the three peer actions

Both Iron & Ember design principles and the spec require Resume to read as "the safe default" while Finish and Discard read as "deliberate exits." The chosen layout:

```
[ ◀ Resume ]              [Log a set before finishing]  [ Finish ]   [ Discard ]
  outline                  warm-ash/60 helper            molten        ghost
                                                         (or outline   warning-flare
                                                         when disabled)
```

- **Resume** sits leftmost as the default escape from paused mode. Uses `variant="outline"` so it doesn't compete with the molten Finish but still reads as a real button. A `<` chevron icon precedes the label to reinforce "go back."
- **Finish** sits on the right edge of the constructive cluster. Uses the same `molten`/`outline` toggle as Feature 018's header Finish (molten when `canFinish`, outline when disabled). This preserves visual continuity — when the user finally sees Finish, it looks the same as the old one.
- **Discard** sits at the far right as the destructive trailing action. Uses `variant="ghost"` with `text-warning-flare` text — same treatment as the existing Discard buttons being removed. Right-edge placement keeps it out of muscle-memory range of Resume.
- **Helper text** sits between the Resume action and the Finish action so it's adjacent to Finish (the control it explains) without crowding the molten button itself.

Tap targets: all three buttons keep `min-h-12` and adequate horizontal padding. The bar itself has `py-2 px-4` matching the active header so the visual rhythm doesn't shift when paused.

### D-6: Transition between active and paused states

**Decision:** Use a brief height + opacity transition on the paused bar, NOT a layout shift on the page content beneath. The paused bar is `overflow-hidden` and uses `transition-[max-height,opacity] duration-200 ease-out` with `max-h-0 opacity-0` when not rendered and `max-h-16 opacity-100` when rendered.

**Rationale:** A pure mount/unmount feels like a flicker. A height/opacity transition on the bar makes the appearance feel like a controlled reveal without animating any other layout. 200ms is below the "feels laggy" threshold and matches the easing language used elsewhere (Feature 018's exercise-block dimming uses 300ms for tonal shifts; a UI-chrome reveal should be slightly snappier).

`prefers-reduced-motion` honored automatically: the `.harden` reduced-motion CSS reset already in place collapses transition durations to instant.

**Implementation note:** Mount/unmount won't allow a smooth exit — the React tree removes the element before its transition can play. To enable both enter and exit transitions cleanly, the paused bar is always mounted but receives `data-paused={isPaused}` and conditionally applies the `max-h-0 opacity-0 pointer-events-none` classes when not paused. This is simpler than introducing `framer-motion` for one element. Buttons inside the bar use `tabIndex={isPaused ? 0 : -1}` and `aria-hidden={!isPaused}` to keep the collapsed bar out of the focus order and the accessibility tree.

### D-7: What happens to the existing standalone Discard render blocks

The two existing `{isPaused && <Button …>Discard workout</Button>}` blocks in `log.$workoutId.tsx` (one in the event branch, one in the strength branch) are deleted. Discard responsibility moves entirely into `WorkoutPausedBar`. The Dialog component (`Dialog`, `DialogContent`, `DialogTitle`, etc.) and the `showDiscardDialog`/`handleDiscard` state and handlers stay in the route — only the trigger button moves.

`WorkoutPausedBar` receives `onDiscard: () => setShowDiscardDialog(true)` from the route.

## Stack-Specific Details

### React 19 / TypeScript

**Files to modify:**

- `src/components/workout/workout-header.tsx` — remove FINISH-related props and rendering
- `src/routes/_authenticated/log.$workoutId.tsx` — wrap header in sticky container, mount `WorkoutPausedBar`, delete two standalone Discard blocks and the global helper text, pass props through
- `src/components/workout/__tests__/workout-header.test.tsx` (if exists) — update tests for new prop shape

**Files to create:**

- `src/components/workout/workout-paused-bar.tsx` — new component
- `src/components/workout/__tests__/workout-paused-bar.test.tsx` — new test file

**Patterns to follow:**

- `.claude/rules/react-typescript.md` — functional components, props as TS interfaces destructured in signature, `cn()` for conditional classes, Lucide for icons
- `.claude/rules/error-handling.md` — no bare catch, log with `[module-name]` prefix
- `.claude/rules/layout-conventions.md` — N/A (this is sticky chrome, not a page layout)
- Iron & Ember design system — zero border-radius, ALL-CAPS reserved for badges, ember reserved for primary CTAs, surface tonal language
- Feature 018 conventions in `WorkoutHeader` — `min-h-12` tap targets, `font-display` for header type, `material-symbols-outlined` icons (or Lucide where already adopted in this branch — Lucide preferred per `feedback-typography-uppercase`)

**Dependencies:** None. Reuses existing `Button`, `cn`, Lucide icons, Tailwind tokens.

## Integration Points

This feature is single-stack; no cross-stack integration. The contract between `log.$workoutId.tsx` and `WorkoutPausedBar` is the props interface in D-3 above. The Discard dialog state remains owned by the route to preserve the existing dialog mounting structure.

The two render branches (event vs. strength) in the route share the same wrapper + paused bar pattern, ensuring path-symmetry per assertion A-010 in the spec.

## Risks & Unknowns

- **Risk:** Sticky-stacking edge cases on small viewports. If the paused bar pushes the visible content below the fold to nothing, the first exercise block could be entirely hidden when paused.
  - **Mitigation:** The paused bar is a single row (~56px). Combined with the active header (~56px), total chrome is ~112px when paused. On a 375x667 viewport that leaves ~555px of content visible, which still shows at least the first set row. Verify during manual QA on a small device profile.
- **Risk:** Always-mounted-paused-bar pattern (D-6) introduces nodes in the DOM that screen readers might announce despite `aria-hidden`.
  - **Mitigation:** `aria-hidden="true"` plus `tabIndex={-1}` on contained interactive elements is the standard pattern. Verify with VoiceOver / TalkBack during accessibility QA.
- **Risk:** Users instinctively tap where Finish used to be (top-right of header) and find the cast button instead, accidentally toggling broadcast.
  - **Mitigation:** Zero existing users (per current project state); no muscle memory exists to break. Acceptable risk. Cast button only renders when `isBroadcasting` is true, further narrowing the misclick window.
- **Unknown:** Whether the paused bar should also stick to the top when scrolled, or only ride along with the header.
  - **Resolution plan:** D-2 chooses single-wrapper sticky, which makes both pin together. Confirmed during implementation review.
- **Unknown:** Whether the Resume button in the paused bar should be visually identical to the play-arrow in the active header, or use a labelled button for clarity.
  - **Resolution plan:** D-5 specifies a labelled outline button with chevron icon. Revisit if usability testing on a real device shows redundancy with the existing pause/play toggle.

## Testing Strategy

**Unit/component tests** (Vitest + Testing Library):

- New `workout-paused-bar.test.tsx` covering:
  - Renders Resume, Finish, Discard when `isPaused` is reflected via prop (or always mounted with `data-paused`)
  - Finish is enabled iff `canFinish` is true
  - Helper text appears iff `showFinishHelper` is true
  - Each button fires its corresponding callback
  - When collapsed, contained buttons are not focusable (`tabIndex={-1}`) and `aria-hidden="true"`
- Update `workout-header.test.tsx` (or create if missing):
  - Active header no longer renders any element matching "Finish" (assertion A-001, A-002)
  - Pause button still present and functional in active state
- Route-level integration test (or RTL render of `log.$workoutId.tsx`) covering assertions A-006, A-008, A-011: pause toggle shows/hides the bar, helper does not appear in active header, resume restores active state.

**Manual QA pass:**

- Strength path: start workout, verify no Finish in header. Pause, verify bar appears with helper text (no sets yet). Log a set. Pause again, verify helper is gone and Finish is enabled and molten. Tap Finish, verify session completes.
- Event path: same flow, verify Finish is always enabled in the paused bar (event path doesn't gate on set count).
- Resume path: pause, then resume, verify bar collapses and active header is back to timer + pause + cast.
- Discard path: pause, tap Discard, verify existing dialog still appears and behaves correctly.
- Reduced motion: enable OS-level reduced motion, verify the bar appears/disappears instantly.
- Small viewport (375x667): verify the paused bar doesn't crowd content off-screen.
- Screen reader (VoiceOver or TalkBack): verify the collapsed paused bar is not announced; verify the expanded bar's three buttons are reachable in logical order.

**Test files to update:**

- `src/components/workout/__tests__/workout-header.test.tsx`
- `src/components/workout/__tests__/workout-paused-bar.test.tsx` (new)
- Any existing route-level test for `log.$workoutId.tsx` that asserts on header contents
