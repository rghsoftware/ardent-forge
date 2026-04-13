# Quick Plan: Minimize Rest Timer

**Task:** Add a way to minimize the rest timer so it doesn't always own the full screen.

**Goal:** Allow athletes to collapse the rest timer into a compact sticky banner while resting, letting them review the exercise list, check prescribed weights, or pre-populate sets -- then expand back to full-screen when desired.

---

## Current Behavior

In `log.$workoutId.tsx`, when `restTimer` is truthy the entire exercise view is replaced by `<RestView>` (line 531). The exercise view is hidden via `{!restTimer && (...)}` (line 542). There is no way to access the workout screen during rest without skipping the timer.

---

## Approach

### 1. Add `restMinimized` local state to the route

In `log.$workoutId.tsx`, add `const [restMinimized, setRestMinimized] = useState(false)`.

Reset it to `false` whenever `restTimer` becomes `null` (rest ends) using an effect or by driving it off a `useEffect` dependency on `restTimer`.

### 2. Add minimize button to `RestPanel`

Add an optional `onMinimize?: () => void` prop to `RestPanelProps` in `rest-panel.tsx`. When provided, render a small minimize/collapse icon button (top-right corner of the panel, or below the Skip button). Label: accessible aria-label "Minimize rest timer".

### 3. Thread `onMinimize` through `RestView`

Add `onMinimize?: () => void` to `RestViewProps` and pass it down to `<RestPanel>`.

### 4. New `RestTimerBanner` component

Create `src/components/workout/rest-timer-banner.tsx` -- a compact sticky strip:

```
[ REST  0:47  ──────────────── ]  [ Expand ]  [ Skip ]
```

Props: `remaining`, `total`, `onExpand`, `onSkip`.

Design: fixed at the bottom of the content area (not the screen -- inside the scrollable page container), `bg-surface-iron`, ember-colored countdown text, thin ember progress bar below the text row. Zero border-radius (Iron & Ember). Min-height 48px (gym-floor touch target).

### 5. Update `log.$workoutId.tsx` render logic

```tsx
{restTimer && !restMinimized && (
  <RestView
    restTimer={restTimer}
    ...
    onMinimize={() => setRestMinimized(true)}
  />
)}

{restTimer && restMinimized && (
  <RestTimerBanner
    remaining={restTimer.remaining}
    total={restTimer.total}
    onExpand={() => setRestMinimized(false)}
    onSkip={skipRest}
  />
)}

{(!restTimer || restMinimized) && (
  /* existing exercise view */
)}
```

Reset `restMinimized` when rest ends:
```tsx
useEffect(() => {
  if (!restTimer) setRestMinimized(false)
}, [restTimer])
```

---

## Verification

- Resting -> tap minimize -> exercise list is visible, compact banner shows at bottom with live countdown.
- Tapping "Expand" on the banner returns to full-screen `RestView`.
- Tapping "Skip" on the banner ends the rest and clears the banner.
- Rest naturally expiring (countdown hits 0) clears the banner and returns to exercise view.
- `restMinimized` state does not persist across rest periods.
- Touch targets on banner >= 48px.

---

## Risks

- The banner countdown must stay live. Since `restTimer.remaining` comes from the store, it will tick naturally -- no extra wiring needed.
- `RestPanel` already has `onAdjust` as optional; `onMinimize` follows the same pattern -- safe additive change.
- Circuit `RestPanel` usage in `circuit-panel.tsx` omits `onMinimize` (no prop passed) -- no change required there.
