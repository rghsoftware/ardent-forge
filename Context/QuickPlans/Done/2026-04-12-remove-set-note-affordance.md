# Quick Plan: Remove Note Affordance from Set Rows

**Task:** Remove the ADD NOTE button from individual set rows in the workout log.

**Goal:** Set rows should show only: set number, weight, reps, and confirm/status. No note affordance.

**Approach:**
1. In `src/components/workout/set-row.tsx`:
   - Remove the `{loggedSetId && <NoteAffordance ... />}` block and its surrounding div (lines ~291-303)
   - Remove the `setSetNote` store selector (no longer needed)
   - Remove the `storedSet` store selector (no longer needed)
   - Remove the `noteValue` useMemo (no longer needed)
   - Remove the `hasNote` computed value (no longer needed)
   - Remove the `loggedSetId` prop and its JSDoc from `SetRowProps`
   - Remove the `NoteAffordance` import
2. In `src/components/workout/exercise-block.tsx`:
   - Remove `loggedSetId={set.id}` from the `<SetRow>` usage

**Verification:** `bun run build` passes with no TS errors.

**Risks:** Low. The set-level note store action (`setSetNote`) and data model remain intact -- only the UI entry point is removed. If set notes need to return, the prop and affordance can be re-added.
