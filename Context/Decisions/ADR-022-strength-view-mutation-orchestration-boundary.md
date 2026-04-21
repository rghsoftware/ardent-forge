# ADR-022: Mutation Orchestration Boundary in StrengthWorkoutView

**Date:** 2026-04-20
**Status:** Proposed
**Context:** PR #115 review finding P22-015

---

## Context

After extracting `StrengthWorkoutView` from `log.$workoutId.tsx`, the component receives both a raw hook operation (`confirmSet`) and a parent-wrapped handler (`handleConfirmSet`). The two are not interchangeable:

- `handleConfirmSet` (strength sets): calls `setRestMinimized(false)` before confirming, normalizes raw string inputs via `parseNumericInput`, then calls `confirmSet`
- `confirmSet` (circuit, cardio, ruck sets): called directly, bypassing rest-timer minimization and input normalization

This means the same physical action -- completing a set -- takes two different code paths depending on modality. The inconsistency is invisible from the component's prop interface.

## Decision Needed

Where does mutation orchestration belong: in the route or in the view?

### Option A: Orchestration stays in the route (current state)

The route wraps `confirmSet` into modality-specific handlers (`handleConfirmSet`, and in future `handleCardioConfirmSet`, etc.) and passes each to the view. The view is a pure presentation component that calls whatever handler it receives.

**Pros:** View has no orchestration logic; route owns all side effects.
**Cons:** Props proliferate as modalities grow; view cannot change its own orchestration; the "two paths" bug can silently re-emerge on new modalities.

### Option B: Orchestration moves into the view

The view receives only `confirmSet` (raw) plus the data it needs (`setRestMinimized`). The view owns the normalization and side-effect logic per modality.

**Pros:** All set-completion paths live together; adding a modality cannot silently bypass orchestration.
**Cons:** View has business logic; harder to test orchestration in isolation.

### Option C: Extract a per-modality orchestration hook

A `useSetConfirmation` hook (or similar) wraps `confirmSet` and `setRestMinimized`, encapsulates normalization, and returns modality-aware handlers. Both the route and view call into the hook rather than each other.

**Pros:** Clean separation; testable; view and route stay thin.
**Cons:** Additional abstraction layer; only justified if orchestration complexity grows.

## Recommendation

**Option B** is the right default for current complexity: move `handleConfirmSet` logic into the view so all set-completion paths are colocated. Revisit Option C if a third or fourth modality requires materially different orchestration.

This decision should be resolved before the next feature that adds a new workout modality or modifies the set-confirmation flow, to prevent the inconsistency from hardening further.

## Consequences

- `handleConfirmSet` is removed from the route's prop set passed to `StrengthWorkoutView`
- `setRestMinimized` remains a prop (used for rest-timer minimization side effect)
- Normalization logic (`parseNumericInput`) moves into the view's strength-set path
- The `confirmSet` prop type may need `exerciseName?: string` threading for the strength path
