# Steps: Builder Progressive Disclosure & Contextual Help

**Feature:** 010-Progressive-Disclosure
**Step:** 14.5
**Spec:** [Spec.md](./Spec.md)
**Tech:** [Tech.md](./Tech.md)

---

## Team Composition

| Role     | Specialist          | Stacks                              |
| -------- | ------------------- | ----------------------------------- |
| Frontend | frontend-specialist | React, TypeScript, Tailwind, shadcn |
| Quality  | quality-engineer    | Testing, validation                 |

Single-domain feature (frontend only). All tasks are independent enough for hub-and-spoke `/impl` execution. No cross-domain coordination required.

---

## Implementation Steps

### S001: Session picker "Create new event" button

**Agent:** frontend-specialist
**Files:** `src/components/program-builder/session-picker-sheet.tsx`
**Blocked by:** none
**Parallel:** yes (independent of all other steps)

Add a "Create new event" action alongside the existing "Create new template" button in `SessionPickerSheet`.

**Implementation:**

1. Add `showCreateEvent` boolean state alongside existing `showCreate`
2. Import `EventTemplateForm` from `@/components/event-builder/event-template-form`
3. Below the existing "Create new template" `<Button>`, add a second button: "Create new event" with the `flag` icon (matching the event visual treatment in `TemplateButton`)
4. When `showCreateEvent === true`, render `<EventTemplateForm onSave={handleEventCreated} onCancel={handleCancelCreateEvent} />` in place of the list view (same pattern as `showCreate` toggles to `SessionTemplateForm`)
5. `handleEventCreated` callback: receives the new `SessionTemplate`, calls `onSelect(template.id, template.name, template.category)` to auto-assign to the day slot, then closes the sheet and resets state (same as `handleCreated`)
6. `handleCancelCreateEvent`: sets `showCreateEvent` back to `false`
7. When either `showCreate` or `showCreateEvent` is true, the other creation form and the list view are hidden

**Acceptance:**

- [ ] "Create new event" button visible in session picker alongside "Create new template"
- [ ] Tapping it opens the EventTemplateForm inline
- [ ] Saving auto-assigns the new event template to the target day slot
- [ ] Canceling returns to the template list
- [ ] Existing "Create new template" flow unchanged

---

### S002: Install shadcn Popover and Drawer primitives

**Agent:** frontend-specialist
**Files:** `src/components/ui/popover.tsx` (new), `src/components/ui/drawer.tsx` (new)
**Blocked by:** none
**Parallel:** yes

Run `bunx --bun shadcn@latest add popover drawer` to install both primitives. After install, verify both files exist and update styling to match Iron & Ember:

1. In `popover.tsx`: ensure `PopoverContent` uses `bg-surface-gunmetal rounded-none border-ghost-line/15`
2. In `drawer.tsx`: ensure `DrawerContent` uses `bg-surface-gunmetal rounded-none`

**Acceptance:**

- [ ] `src/components/ui/popover.tsx` exists with Iron & Ember styling
- [ ] `src/components/ui/drawer.tsx` exists with Iron & Ember styling
- [ ] No regressions in existing UI

---

### S003: Create `useMediaQuery` hook

**Agent:** frontend-specialist
**Files:** `src/hooks/use-media-query.ts` (new)
**Blocked by:** none
**Parallel:** yes

Create a lightweight hook using `window.matchMedia`:

```typescript
export function useMediaQuery(query: string): boolean
```

- Returns `true` when the query matches
- Handles SSR (default `false`)
- Cleans up listener on unmount
- Used by HelpTrigger for the 768px desktop/mobile breakpoint

**Acceptance:**

- [ ] Hook returns correct boolean for viewport-based media queries
- [ ] Listener cleaned up on unmount

---

### S004: Create `HelpTrigger` component

**Agent:** frontend-specialist
**Files:** `src/components/ui/help-trigger.tsx` (new)
**Blocked by:** S002, S003
**Parallel:** no

Build the shared responsive help component per R1:

1. Props: `title` (string), `content` (ReactNode), `placement` (`'inline' | 'section'`)
2. Uses `useMediaQuery('(min-width: 768px)')` to branch rendering
3. Desktop (>=768px): Radix `Popover` with `PopoverTrigger` (the icon button) and `PopoverContent` styled per spec
4. Mobile (<768px): `Drawer` with `DrawerTrigger` (the icon button) and `DrawerContent` styled per spec
5. Trigger: `<Icon name="help_outline" size={20} />` with `text-warm-ash hover:text-ember transition-colors`
6. Content layout: `title` in `font-heading text-sm font-medium text-bone-white`, `content` body in `font-body text-xs text-warm-ash`
7. Popover: `max-w-[360px]`, `bg-surface-gunmetal`, `p-4`
8. Drawer: full-width, `bg-surface-gunmetal`, `p-4 pb-6`, visual handle via vaul default

**Acceptance:**

- [ ] TA-14: Opens popover on desktop (>=768px)
- [ ] TA-15: Opens drawer on mobile (<768px)
- [ ] Icon uses correct size, color, and hover state
- [ ] Dismiss works via tap outside, tap icon again, swipe down (drawer)

---

### S005: Create help content constants

**Agent:** frontend-specialist
**Files:** `src/components/builders/help-content.ts` (new)
**Blocked by:** none
**Parallel:** yes

Create the centralized help text file with typed constants:

1. `GROUP_TYPE_HELP` -- Record<GroupType, { label: string; description: string }>
   - Straight: "One exercise at a time. Complete all sets before moving on."
   - Superset: "Two exercises alternated set-for-set with minimal rest."
   - Circuit: "Three or more exercises performed back-to-back as rounds."
   - Complex: "Multiple barbell movements performed without releasing the bar."
   - EMOM: "Fixed work every minute on the minute for a set duration."
   - AMRAP: "As many rounds as possible within a time cap."
   - Couplet: "Two movements alternated for rounds, typically for time."

2. `BLOCK_TYPE_HELP` -- Record<BlockType, { label: string; description: string; oneLiner: string }>
   - Accumulation: desc per spec, oneLiner: "High volume, moderate intensity -- builds work capacity."
   - Intensification: oneLiner: "Moderate volume, high intensity -- shifts toward heavier loads."
   - Realization: oneLiner: "Low volume, peak intensity -- tests or expresses strength gains."
   - Deload: oneLiner: "Reduced volume and intensity -- planned recovery."
   - Test: oneLiner: "Maximal testing -- 1RM attempts or benchmark assessments."

3. `SOURCE_HELP` -- Record<ProgramSource, { label: string; description: string }>
   - All 7 sources with descriptions per spec

**Rules:** No emoji, no exclamation marks, industrial vocabulary throughout.

**Acceptance:**

- [ ] All GroupType, BlockType, and ProgramSource values have entries
- [ ] Text follows industrial vocabulary guidelines
- [ ] Types are correctly keyed to domain enums

---

### S006: Create visibility mapping constants

**Agent:** frontend-specialist
**Files:** `src/components/builders/visibility-maps.ts` (new)
**Blocked by:** none
**Parallel:** yes

Create the data-driven visibility lookup tables per Tech.md D2-D5:

1. `CATEGORY_FIELD_VISIBILITY` -- maps SessionType to `{ scoring: boolean; timeCap: boolean }`
2. `CATEGORY_SCHEME_TYPES` -- maps SessionType to default-visible `SetScheme['type'][]`
3. `SCHEME_LOAD_VISIBILITY` -- maps `SetScheme['type']` to `LoadSpec['type'][] | null`
4. `GROUP_FIELD_VISIBILITY` -- maps GroupType to `{ restBetweenRounds: boolean; restBetweenActivities: boolean; rounds: boolean }`

All constants are typed against domain enums and exported for use by builder components.

**Acceptance:**

- [ ] All mappings match the visibility tables in the feature brief
- [ ] TypeScript enforces exhaustive coverage of all enum values
- [ ] Constants are independently importable

---

### S007: Template builder category-aware field visibility

**Agent:** frontend-specialist
**Files:** `src/components/session-builder/session-template-form.tsx`, `src/components/session-builder/collapsed-fields-row.tsx` (new)
**Blocked by:** S006
**Parallel:** no

Implement R2: conditional field visibility based on session category.

**Implementation:**

1. Import `CATEGORY_FIELD_VISIBILITY` from `builders/visibility-maps`
2. Derive `{ scoring: showScoring, timeCap: showTimeCap }` from `CATEGORY_FIELD_VISIBILITY[category]`
3. When `showScoring === false && showTimeCap === false`: replace both fields with a `CollapsedFieldsRow` listing "Scoring, Time Cap"
4. When `showScoring === false` only: replace Scoring with `CollapsedFieldsRow` listing "Scoring"
5. `CollapsedFieldsRow` component:
   - Props: `labels: string[]`, `children: ReactNode` (the hidden fields), `defaultExpanded?: boolean`
   - Collapsed: `bg-surface-charcoal px-3 py-2`, label in `text-warm-ash font-body text-xs uppercase tracking-wider`, `expand_more` icon
   - Expanded: same header with `expand_less` icon, children rendered below
6. Category change: values in hidden fields are NOT cleared -- they remain in React state. Only visibility changes.
7. Rest Between Groups remains always visible (outside the collapsed row)

**Acceptance:**

- [ ] TA-1: Selecting Strength collapses Scoring and Time Cap
- [ ] TA-2: Expanding reveals fields with preserved values
- [ ] TA-3: Switching to Conditioning shows fields without data loss
- [ ] Rest Between Groups visible for all categories

---

### S008: Activity group staged reveal

**Agent:** frontend-specialist
**Files:** `src/components/session-builder/activity-group-editor.tsx`, `src/components/session-builder/session-template-form.tsx`
**Blocked by:** S004, S005, S006
**Parallel:** no

Implement R3: two-stage group creation flow.

**Implementation:**

1. In `SessionTemplateForm.handleAddGroup`: change default `groupType` from `'STRAIGHT_SETS'` to `null`. Remove the default activity creation (empty activities array).
2. Update `ActivityGroupData` local type: `groupType: GroupType | null`
3. In `ActivityGroupEditor`: check `groupType === null` for Stage 1
4. **Stage 1 (type selection):**
   - Render group type `ToggleGroup` (existing 7 options)
   - Add `HelpTrigger` next to the group type section with `GROUP_TYPE_HELP` content
   - No rest fields, no exercises, no "Add exercise" button
5. **Stage 2 (after type selected):**
   - Import `GROUP_FIELD_VISIBILITY` from `builders/visibility-maps`
   - Show rest fields conditionally based on `GROUP_FIELD_VISIBILITY[groupType]`
   - Show "+ Select exercise" button
   - Exercise cards render as exercises are added
6. On type change (Stage 2 to Stage 2): reset `restBetweenRounds`, `restBetweenActivities`, `rounds` to undefined. Preserve exercises.
7. Replace existing `GROUP_TYPES_WITH_ROUNDS` check with `GROUP_FIELD_VISIBILITY[groupType].rounds`

**Acceptance:**

- [ ] TA-4: "+ Add group" shows only type selector and HelpTrigger
- [ ] TA-5: Selecting Circuit reveals Rounds, Rest / Rounds, Rest / Exercises
- [ ] TA-6: Selecting Complex shows no rest fields
- [ ] TA-7: Changing Circuit to Straight preserves exercises, resets rest

---

### S009: Set scheme editor category-filtered types

**Agent:** frontend-specialist
**Files:** `src/components/session-builder/set-scheme-editor.tsx`, `src/components/session-builder/session-template-form.tsx`, `src/components/session-builder/activity-group-editor.tsx`, `src/components/session-builder/activity-editor.tsx`
**Blocked by:** S006
**Parallel:** yes (independent of S007, S008)

Implement R4: filter set scheme types by session category.

**Implementation:**

1. Thread `sessionCategory: SessionType` prop from `SessionTemplateForm` through `ActivityGroupEditor` > `ActivityEditor` > `SetSchemeEditor`
2. Thread `showAllTypes: boolean` and `onShowAllTypesChange: (v: boolean) => void` from `SessionTemplateForm` state through the same path
3. In `SetSchemeEditor`: import `CATEGORY_SCHEME_TYPES` from `builders/visibility-maps`
4. Derive `defaultTypes = CATEGORY_SCHEME_TYPES[sessionCategory]`
5. If `defaultTypes.length === 0` (Mixed): show all types, hide "Show all types" button
6. If `!showAllTypes`: filter `SCHEME_GROUPS` to only include types in `defaultTypes`. Omit entire group headers when no types in that group are visible.
7. Below the filtered type list: render "Show all types" ghost button (`text-warm-ash font-body text-xs uppercase tracking-wider`) that calls `onShowAllTypesChange(true)`
8. When `showAllTypes === true`: show all 12 types with category headers, hide the toggle button
9. On scheme type change: if the newly selected type was in the filtered set, keep `showAllTypes` unchanged. (The toggle only affects which types are visible for selection, not what's already selected.)

**Acceptance:**

- [ ] TA-8: Strength shows only FixedSets, PercentageSets, WorkToMax
- [ ] TA-9: "Show all types" reveals all 12 with headers
- [ ] TA-10: Cardio/Metcon headers omitted when filtering for Strength
- [ ] Mixed sessions show all 12 with no toggle button

---

### S010: Load type context-filtered options

**Agent:** frontend-specialist
**Files:** `src/components/session-builder/set-scheme-editor.tsx` (LoadSpecEditor section)
**Blocked by:** S006
**Parallel:** yes (independent of S007, S008, S009)

Implement R5: filter load options by set scheme type.

**Implementation:**

1. In `LoadSpecEditor`: accept new prop `schemeType: SetScheme['type']`
2. Import `SCHEME_LOAD_VISIBILITY` from `builders/visibility-maps`
3. Derive `allowedLoads = SCHEME_LOAD_VISIBILITY[schemeType]`
4. If `allowedLoads === null`: return `null` (hide entire load section)
5. If `allowedLoads` is an array: filter `LOAD_TYPES` constant to only include types in `allowedLoads`
6. Preserve existing `exerciseSupports1RM` filtering (remove `percentageOf1RM` when not supported) -- apply both filters
7. If the currently selected load type is not in the filtered list after a scheme type change, reset to `'unspecified'`
8. Pass `schemeType` from the parent render site where `LoadSpecEditor` is invoked (inside each type-specific fields component that uses it)

**Acceptance:**

- [ ] TA-11: PercentageSets hides load section entirely
- [ ] TA-12: FixedSets shows Weight, RPE, BW, BW+, None
- [ ] TA-13: WorkToMax shows only Weight, RPE, None
- [ ] CardioSteadyState, CardioInterval, RuckMarch hide load section
- [ ] PercentageOfMaxReps hides load section

---

### S011: Program builder block type help

**Agent:** frontend-specialist
**Files:** `src/components/program-builder/block-editor.tsx`, `src/components/program-builder/mobile-block-editor.tsx`
**Blocked by:** S004, S005
**Parallel:** yes (independent of S007-S010)

Implement R6: HelpTrigger and one-liner for block types.

**Implementation:**

1. Import `HelpTrigger` and `BLOCK_TYPE_HELP` into both `block-editor.tsx` and `mobile-block-editor.tsx`
2. Add `<HelpTrigger placement="section" title="Block Types" content={...} />` next to the block type section label
   - Content: render all 5 block types with label + description from `BLOCK_TYPE_HELP`
3. Below the block type `ToggleGroup`, add a one-liner:
   - `<p className="text-warm-ash font-body text-xs mt-1">{BLOCK_TYPE_HELP[block.blockType].oneLiner}</p>`
   - Only shown when a block type is selected (always true since default is ACCUMULATION)
4. Apply to both desktop (`BlockEditor`) and mobile (`MobileBlockEditor`) components
5. Extract the duplicated `BLOCK_TYPE_STYLES` into `constants.ts` to reduce duplication (opportunistic cleanup since we're already editing both files)

**Acceptance:**

- [ ] TA-16: Block type HelpTrigger shows correct explanation for Accumulation
- [ ] TA-17: Selecting Intensification shows one-liner below pills
- [ ] Both desktop and mobile have identical help behavior

---

### S012: Program builder source badge help

**Agent:** frontend-specialist
**Files:** `src/components/program-builder/program-form.tsx`
**Blocked by:** S004, S005
**Parallel:** yes (independent of S007-S011)

Implement R7: HelpTrigger for program source types.

**Implementation:**

1. Import `HelpTrigger` and `SOURCE_HELP` into `program-form.tsx`
2. Add `<HelpTrigger placement="section" title="Program Sources" content={...} />` next to the Source section label
3. Content: render all 7 sources with label + description from `SOURCE_HELP`
4. Mark future sources (Marketplace, AI) with "(Future)" in their descriptions

**Acceptance:**

- [ ] TA-18: Source HelpTrigger shows correct explanation for each source type
- [ ] Future sources clearly marked

---

### S013: Typography utility classes

**Agent:** frontend-specialist
**Files:** `src/index.css`
**Blocked by:** none
**Parallel:** yes

Implement R8: add formal typography utility classes referenced by DESIGN.md.

**Implementation:**

Add to `src/index.css` alongside existing `.text-readout` and `.text-industrial`:

```css
.text-label-large {
  font-family: var(--font-heading);
  font-size: 0.875rem; /* 14px */
  line-height: 1.25rem; /* 20px */
  font-weight: 500;
  letter-spacing: 0.01em;
}

.text-body-small {
  font-family: var(--font-body);
  font-size: 0.75rem; /* 12px */
  line-height: 1rem; /* 16px */
  font-weight: 400;
}
```

These map to the MD3 type scale names referenced in DESIGN.md, using the project's actual font families.

**Acceptance:**

- [ ] `.text-label-large` and `.text-body-small` classes are defined and usable
- [ ] Match DESIGN.md type scale intent

---

### S014-T: Validation pass

**Agent:** quality-engineer
**Files:** all modified/new files from S001-S013
**Blocked by:** S001, S004, S007, S008, S009, S010, S011, S012, S013
**Parallel:** no (runs after all build steps)

Validate the full feature against acceptance criteria:

1. **Functional validation:**
   - Walk through all 20 testable assertions (TA-1 through TA-20)
   - Verify each visibility mapping matches the spec tables exactly
   - Test category switching preserves form values
   - Test group type changes reset rest fields but preserve exercises
   - Test "Show all types" persists within editing session
   - Test event creation from session picker auto-assigns to day slot

2. **Design compliance:**
   - All new elements use 0px border radius
   - Correct surface colors (surface-gunmetal for help, surface-charcoal for collapsed rows)
   - Correct text colors (warm-ash for secondary, ember for hover/accent)
   - Correct fonts (Space Grotesk for headings, Inter for body)
   - No emoji or exclamation marks in help text

3. **Regression check:**
   - Existing template save/load/edit flows work unchanged (TA-19)
   - Existing program builder DnD works unchanged
   - Session picker "Create new template" flow unchanged
   - EVENT templates in library unaffected

4. **Responsive check:**
   - HelpTrigger renders popover on desktop, drawer on mobile
   - All builder screens functional at 390px and 2560px widths

**Acceptance:**

- [ ] All 20 testable assertions pass
- [ ] No design drift from Iron & Ember spec
- [ ] No regressions in existing flows

---

## Dependency Graph

```
S001 ─────────────────────────────────────────────────┐
S002 ──────┐                                          │
S003 ──────┤                                          │
           ├── S004 ──┬── S008                        │
S005 ──────┤          ├── S011 ─────┐                 │
           │          └── S012 ─────┤                 │
S006 ──────┼── S007                 │                 │
           ├── S009                 │                 │
           └── S010                 ├── S014-T        │
S013 ───────────────────────────────┤                 │
                                    └─────────────────┘
```

**Wave 1 (parallel):** S001, S002, S003, S005, S006, S013
**Wave 2 (parallel, after S002+S003):** S004
**Wave 3 (parallel, after S004+S005+S006):** S007, S008, S009, S010, S011, S012
**Wave 4 (sequential, after all):** S014-T

---

## Milestone

**M1: Progressive Disclosure Complete** (after S014-T)

All progressive disclosure and contextual help is implemented across template builder and program builder. The session picker supports inline event creation. All visibility rules are data-driven and all help content uses industrial vocabulary per the Iron & Ember design system.

**Testable assertions covered:** TA-1 through TA-20
