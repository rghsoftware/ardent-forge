# Quick Plan: P10-008 -- Narrow `onChange` in Scheme-Field Components

**Date:** 2026-04-05
**Source:** Context/Backlog/Ideas.md (P10-008)

## Task

All 12 scheme-field components in `src/components/session-builder/scheme-fields/` accept a wide `onChange: (s: SetScheme) => void` prop, but each component can only emit its own variant. The prop should be narrowed to prevent cross-variant emissions and make the contract explicit.

## Goal

Change `onChange` in all 12 components from `(s: SetScheme) => void` to `(s: SetScheme & { type: '<variant>' }) => void`, matching the narrowed type already used for their `value` prop.

## Files

All 12 scheme-field components:

```
src/components/session-builder/scheme-fields/amrap-timed-fields.tsx
src/components/session-builder/scheme-fields/cardio-interval-fields.tsx
src/components/session-builder/scheme-fields/cardio-steady-state-fields.tsx
src/components/session-builder/scheme-fields/descending-reps-fields.tsx
src/components/session-builder/scheme-fields/emom-fields.tsx
src/components/session-builder/scheme-fields/fixed-sets-fields.tsx
src/components/session-builder/scheme-fields/for-reps-fields.tsx
src/components/session-builder/scheme-fields/percentage-of-max-reps-fields.tsx
src/components/session-builder/scheme-fields/percentage-sets-fields.tsx
src/components/session-builder/scheme-fields/ruck-march-fields.tsx
src/components/session-builder/scheme-fields/timed-hold-fields.tsx
src/components/session-builder/scheme-fields/work-to-max-fields.tsx
```

Plus any parent component that passes `onChange` into these fields -- find with a codebase search on each component's import.

## Approach

1. For each of the 12 components, update the `onChange` prop type in its `Props` interface:
   ```typescript
   // Before
   onChange: (s: SetScheme) => void
   // After
   onChange: (s: SetScheme & { type: 'fixedSets' }) => void
   ```
2. Check each call site within the component where `onChange(...)` is invoked. TypeScript will catch any emissions of the wrong shape at compile time.
3. Find all parent call sites (search `<FixedSetsFields`, etc.) and verify their handler signatures are compatible. Most should already be narrowed since they pattern-match on `scheme.type`.
4. Run `bun run build` to confirm zero type errors.

## Verification

- `bun run build` passes with no new TypeScript errors
- Each component's `onChange` prop type matches its `value` prop narrowing (both use `SetScheme & { type: '<variant>' }`)
- No behavior changes -- purely a type-level refactor

## Risks

- Parent call sites that pass a generic `(s: SetScheme) => void` handler will need to be updated to accept the narrowed type. This is a widening issue: `(s: FixedSets) => void` is NOT assignable to `(s: SetScheme) => void` due to contravariance. The fix is to widen the parent handler to accept `SetScheme` while the implementation narrows via the discriminated union switch -- or to cast. Investigate before assuming it's zero-touch for callers.
- Mitigation: grep for all 12 component usages first, check handler signatures, fix as needed.
