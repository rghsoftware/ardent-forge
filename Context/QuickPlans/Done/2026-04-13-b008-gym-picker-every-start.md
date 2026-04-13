# Quick Plan: B008 -- Gym Picker Shown on Every Workout Start

**Date:** 2026-04-13
**Bug:** B008

---

## Task

The gym selector sheet appears on every workout start, even when the user previously selected a gym.

---

## Root Cause

All three workout-start handlers gate on `firstWorkoutCompleted` (an onboarding flag) to decide whether to use the saved gym choice:

```ts
if (firstWorkoutCompleted) {
  choice = readLastGymChoice()
  if (choice === null) {
    choice = await openGymPicker({ userId })
  }
} else {
  // First workout: always prompt
  choice = await openGymPicker({ userId })
}
```

This is the wrong proxy. `firstWorkoutCompleted` reflects whether onboarding is done -- not whether a gym choice was ever saved. If the flag is `false` for any reason (store not yet initialized, state mismatch, user cleared storage), the picker shows unconditionally, regardless of what `readLastGymChoice()` would return.

The correct gate is `readLastGymChoice()` itself: if a valid choice is stored, use it; otherwise show the picker. No `firstWorkoutCompleted` dependency needed.

---

## Goal

Gym picker only shows when there is no saved gym choice. On all subsequent starts (after the user has picked once), the saved choice is used silently.

---

## Approach

Simplify the gym-choice block in all three handlers to a single expression:

```ts
choice = readLastGymChoice() ?? await openGymPicker({ userId })
```

**Files and locations:**

1. `src/routes/_authenticated/index.tsx`
   - `handleStartWorkout` (~line 162-172)
   - `handleStartProgrammedSession` (~line 215-225)

2. `src/routes/_authenticated/library.tsx`
   - `handleStartFromTemplate` (~line 165-175)

After editing, remove `firstWorkoutCompleted` from the dependency arrays of the two `useCallback` hooks in `index.tsx` (it will no longer be referenced inside them). The `useOnboardingStore((s) => s.firstWorkoutCompleted)` subscription on line 97 of `index.tsx` must remain -- it is used in JSX on line 295.

**No change needed in:**
- `gym-picker-storage.ts` -- `readLastGymChoice()` already handles first-time (returns null) and validates stored values
- `onboarding-store.ts` / `markFirstWorkoutCompleted` -- still called on workout completion for other onboarding purposes

---

## Verification

1. `bun run build` passes (TypeScript clean)
2. Manual flow -- new user:
   - Start first workout → picker shows → select a gym → workout starts
   - Finish workout, return to today page
   - Start second workout → picker does NOT show → workout starts with saved gym choice
3. Manual flow -- picker shows when no choice stored:
   - Clear `ardent_forge_last_gym_choice` from localStorage
   - Start workout → picker shows as expected

---

## Risks

- Low. The change removes a conditional branch; all existing behavior for "no saved choice" is preserved (picker shows). The only behavioral change is: when `firstWorkoutCompleted` was `false` but a saved choice exists in localStorage, the picker no longer shows. This is the correct behavior.
- `firstWorkoutCompleted` is still read in `index.tsx` for the JSX at line 295; the subscription line must not be removed.
