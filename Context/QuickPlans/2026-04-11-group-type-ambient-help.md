# Quick Plan: Ambient group type help in activity group editor

**Task:** Surface the selected group type's one-liner description inline in the group editor

**Goal:** Eliminate the SUPERSET/COUPLET confusion (and COMPLEX/CIRCUIT ambiguity) by showing a
contextual description at the moment of selection -- without requiring the user to tap the help
icon.

## Why this is the problem (not "7 types is too many")

Seven types is appropriate for the audience. The real gap:

- SUPERSET = "two exercises alternated set-for-set with minimal rest"
- COUPLET = "two movements alternated for rounds, typically for time"

Both read as "two exercises, alternated" from the label alone. The distinction is invisible until
the user taps the `HelpTrigger`, which most won't. Same problem exists for COMPLEX vs CIRCUIT.

## Established pattern

`BlockTypeSelector` already does this correctly: renders `BLOCK_TYPE_HELP[value].oneLiner` beneath
the toggle group, updating on every selection. `GROUP_TYPE_HELP` lacks `oneLiner`; `ActivityGroupEditor`
never renders anything below the toggle row.

## Approach

### Step 1 -- `src/components/builders/help-content.ts`

1. Define `GroupTypeHelpEntry` interface (mirrors `BlockTypeHelpEntry`) extending `HelpEntry` with `oneLiner: string`
2. Change `GROUP_TYPE_HELP` satisfies clause from `Record<GroupType, HelpEntry>` to `Record<GroupType, GroupTypeHelpEntry>`
3. Add `oneLiner` to all 7 entries:
   - STRAIGHT_SETS: "One exercise, all sets completed before moving on."
   - SUPERSET: "Two exercises, set-for-set with minimal rest between -- not for time."
   - CIRCUIT: "Three or more exercises performed back-to-back for rounds."
   - COMPLEX: "Barbell only -- multiple movements without releasing the bar."
   - EMOM: "Fixed work every minute on the minute for a set duration."
   - AMRAP: "As many rounds as possible within a time cap."
   - COUPLET: "Two movements alternated for rounds, typically scored for time."

### Step 2 -- `src/components/session-builder/activity-group-editor.tsx`

After the `ToggleGroup`/`HelpTrigger`/delete row, render the selected type's one-liner when
`group.groupType` is non-null:

```tsx
{group.groupType && (
  <p className="px-4 pb-2 font-body text-xs text-warm-ash">
    {GROUP_TYPE_HELP[group.groupType].oneLiner}
  </p>
)}
```

No new state. No new component. Derives from existing selection.

## Verification

- Select SUPERSET: one-liner clearly says "set-for-set ... not for time"
- Select COUPLET: one-liner clearly says "for rounds, typically scored for time"
- Select STRAIGHT_SETS (or no type): description appears / disappears correctly
- Existing `HelpTrigger` popup still works (full descriptions unchanged)
- TypeScript: `GROUP_TYPE_HELP[group.groupType].oneLiner` compiles without casting

## Risks

- Low. Two files, additive only. No logic changes, no state changes.
- Slight layout height increase per group -- acceptable; content is one line.
