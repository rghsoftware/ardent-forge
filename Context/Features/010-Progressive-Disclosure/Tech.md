# Tech: Builder Progressive Disclosure & Contextual Help

**Feature:** 010-Progressive-Disclosure
**Step:** 14.5
**Spec:** [Spec.md](./Spec.md)

---

## Architecture Overview

This feature modifies existing builder components to add context-aware visibility and a new shared help component. No new routes, stores, or backend changes are required. All changes are frontend-only, scoped to React component rendering logic and a new UI primitive.

### Component Hierarchy (affected components)

```
SessionTemplateForm                    -- R2: category-aware field visibility
  |                                        R4: "showAllTypes" state lifted here
  +-- [new] CollapsedFieldsRow         -- R2: expandable row for hidden fields
  +-- ActivityGroupEditor              -- R3: staged reveal
  |     +-- [new] GroupTypeHelp        -- R3: help content for group types
  |     +-- ActivityEditor
  |           +-- SetSchemeEditor      -- R4: category-filtered types, R5: filtered loads
  |                 +-- LoadSpecEditor -- R5: context-filtered options
  +-- [new] HelpTrigger               -- R1: shared component

BuilderPage / ProgramForm             -- context for R6, R7
  +-- BlockEditor                     -- R6: block type help
  +-- MobileBlockEditor               -- R6: block type help (mobile)
  +-- ProgramForm                     -- R7: source help
```

### New Components

| Component            | Location                                                  | Purpose                                                                 |
| -------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `HelpTrigger`        | `src/components/ui/help-trigger.tsx`                      | Shared responsive help component (Popover large screens, Drawer mobile) |
| `Popover`            | `src/components/ui/popover.tsx`                           | shadcn Popover primitive (new install)                                  |
| `Drawer`             | `src/components/ui/drawer.tsx`                            | shadcn Drawer primitive (new install)                                   |
| `CollapsedFieldsRow` | `src/components/session-builder/collapsed-fields-row.tsx` | Expandable row for hidden template-level fields                         |

### Modified Components

| Component             | File                                                       | Changes                                                                                   |
| --------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `SessionTemplateForm` | `src/components/session-builder/session-template-form.tsx` | Add category-aware visibility logic, lift `showAllTypes` state, render CollapsedFieldsRow |
| `ActivityGroupEditor` | `src/components/session-builder/activity-group-editor.tsx` | Two-stage reveal, type-dependent field visibility                                         |
| `SetSchemeEditor`     | `src/components/session-builder/set-scheme-editor.tsx`     | Accept `sessionCategory` prop, filter SCHEME_GROUPS by category, "Show all types" toggle  |
| `LoadSpecEditor`      | (inside `set-scheme-editor.tsx`)                           | Accept `schemeType` prop, filter LOAD_TYPES, conditionally hide entire section            |
| `BlockEditor`         | `src/components/program-builder/block-editor.tsx`          | Add HelpTrigger + one-liner below type pills                                              |
| `MobileBlockEditor`   | `src/components/program-builder/mobile-block-editor.tsx`   | Same as BlockEditor                                                                       |
| `ProgramForm`         | `src/components/program-builder/program-form.tsx`          | Add HelpTrigger next to source section                                                    |

---

## Key Technical Decisions

### D1. HelpTrigger: Popover + Drawer dual rendering

**Decision:** Use `useMediaQuery` (or `window.matchMedia`) to conditionally render shadcn Popover (large screens) or shadcn Drawer (mobile) from a single `HelpTrigger` component.

**Options considered:**

1. Single Popover with responsive positioning -- Rejected: Popovers don't provide swipe-to-dismiss or full-width behavior on mobile
2. Sheet with side="bottom" -- Rejected: lacks swipe gesture, feels wrong for dismissible help
3. **Popover (large screens) + Drawer (mobile)** -- Chosen: each primitive is purpose-built for its context

**Implementation:**

```tsx
function HelpTrigger({ title, content, placement }: HelpTriggerProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [open, setOpen] = useState(false)

  const trigger = (
    <button onClick={() => setOpen(!open)}>
      <Icon name="help_outline" size={20} className="..." />
    </button>
  )

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        {/* ... */}
      </Popover>
    )
  }
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {/* ... */}
    </Drawer>
  )
}
```

The `useMediaQuery` hook does not exist in the codebase. Options:

- Add a lightweight custom hook (~10 lines) using `window.matchMedia`
- The shadcn Drawer docs recommend this pattern and provide an example

### D2. Category visibility: data-driven mapping

**Decision:** Define a `CATEGORY_FIELD_VISIBILITY` constant mapping `SessionType` to field visibility flags, rather than inline conditionals.

**Rationale:** The visibility rules are a pure function of category. A lookup table is more readable, testable, and extensible than scattered `if/else` chains.

```typescript
const CATEGORY_FIELD_VISIBILITY: Record<SessionType, { scoring: boolean; timeCap: boolean }> = {
  STRENGTH: { scoring: false, timeCap: false },
  CONDITIONING: { scoring: true, timeCap: true },
  SE: { scoring: false, timeCap: true },
  MIXED: { scoring: true, timeCap: true },
  EVENT: { scoring: false, timeCap: false }, // unused but safe
}
```

### D3. Set scheme filtering: data-driven mapping

**Decision:** Define a `CATEGORY_SCHEME_TYPES` constant mapping `SessionType` to the default-visible set scheme types.

```typescript
import type { SetScheme } from '@/domain/types/set-scheme'

const CATEGORY_SCHEME_TYPES: Record<SessionType, SetScheme['type'][]> = {
  STRENGTH: ['fixedSets', 'percentageSets', 'workToMax'],
  CONDITIONING: [
    'cardioSteadyState',
    'cardioInterval',
    'ruckMarch',
    'emom',
    'amrapTimed',
    'descendingReps',
  ],
  SE: ['forReps', 'timedHold', 'percentageOfMaxReps'],
  MIXED: [], // empty = show all
  EVENT: [],
}
```

When `CATEGORY_SCHEME_TYPES[category]` is empty, all types are shown and the "Show all types" button is hidden.

### D4. Load filtering: data-driven mapping

**Decision:** Define a `SCHEME_LOAD_VISIBILITY` constant mapping `SetScheme['type']` to either `null` (load section hidden) or an array of visible `LoadSpec['type']` values.

```typescript
const SCHEME_LOAD_VISIBILITY: Record<SetScheme['type'], LoadSpec['type'][] | null> = {
  fixedSets: ['absolute', 'rpe', 'bodyweight', 'bodyweightPlus', 'unspecified'],
  percentageSets: null, // hidden
  workToMax: ['absolute', 'rpe', 'unspecified'],
  forReps: ['absolute', 'bodyweight', 'bodyweightPlus', 'unspecified'],
  timedHold: ['absolute', 'bodyweight', 'bodyweightPlus', 'unspecified'],
  percentageOfMaxReps: null, // hidden
  cardioSteadyState: null, // hidden
  cardioInterval: null, // hidden
  ruckMarch: null, // hidden
  emom: ['absolute', 'rpe', 'bodyweight', 'bodyweightPlus', 'unspecified'],
  amrapTimed: ['absolute', 'rpe', 'bodyweight', 'bodyweightPlus', 'unspecified'],
  descendingReps: ['absolute', 'rpe', 'bodyweight', 'bodyweightPlus', 'unspecified'],
}
```

### D5. Group field visibility: data-driven mapping

**Decision:** Extend the existing `GROUP_TYPES_WITH_ROUNDS` pattern into a full visibility map.

```typescript
const GROUP_FIELD_VISIBILITY: Record<
  GroupType,
  {
    restBetweenRounds: boolean
    restBetweenActivities: boolean
    rounds: boolean
  }
> = {
  STRAIGHT_SETS: { restBetweenRounds: false, restBetweenActivities: true, rounds: false },
  SUPERSET: { restBetweenRounds: false, restBetweenActivities: true, rounds: false },
  CIRCUIT: { restBetweenRounds: true, restBetweenActivities: true, rounds: true },
  COMPLEX: { restBetweenRounds: false, restBetweenActivities: false, rounds: false },
  EMOM: { restBetweenRounds: false, restBetweenActivities: false, rounds: false },
  AMRAP: { restBetweenRounds: false, restBetweenActivities: false, rounds: false },
  COUPLET: { restBetweenRounds: false, restBetweenActivities: true, rounds: true },
}
```

### D6. Staged group reveal: `groupType` starts as `null`

**Decision:** Change the initial group creation to set `groupType: null` instead of defaulting to `STRAIGHT_SETS`. The `ActivityGroupEditor` checks for `null` and renders Stage 1 (type selector only). After selection, it transitions to Stage 2.

**Impact on types:** The `ActivityGroupData` type (local to the form, not the domain schema) needs `groupType: GroupType | null`. The domain `ActivityGroup` Zod schema is unaffected since groups are only saved after type selection.

**Impact on `handleAddGroup`:** No longer creates a default activity. The first activity is added after type selection (Stage 2) or when the user taps "+ Select exercise".

### D7. Help content: co-located static constants

**Decision:** Store help text as static constants in a dedicated file `src/components/builders/help-content.ts` rather than in each component.

**Rationale:** Centralizes all help copy for easy review and editing. These are not i18n strings (per Won't Have), just organized constants.

```typescript
export const GROUP_TYPE_HELP: Record<GroupType, { label: string; description: string }> = { ... }
export const BLOCK_TYPE_HELP: Record<BlockType, { label: string; description: string; oneLiner: string }> = { ... }
export const SOURCE_HELP: Record<ProgramSource, { label: string; description: string }> = { ... }
```

---

## Prop Threading

New props that need to flow through the component tree:

| Prop                   | From                        | To                                                               | Type                   |
| ---------------------- | --------------------------- | ---------------------------------------------------------------- | ---------------------- |
| `sessionCategory`      | `SessionTemplateForm`       | `SetSchemeEditor` (via `ActivityGroupEditor` > `ActivityEditor`) | `SessionType`          |
| `showAllTypes`         | `SessionTemplateForm` state | `SetSchemeEditor` (via same path)                                | `boolean`              |
| `onShowAllTypesChange` | `SessionTemplateForm`       | `SetSchemeEditor` (via same path)                                | `(v: boolean) => void` |
| `schemeType`           | `SetSchemeEditor`           | `LoadSpecEditor`                                                 | `SetScheme['type']`    |

Threading `sessionCategory` through 3 levels (Form > GroupEditor > ActivityEditor > SetSchemeEditor) is acceptable for this bounded hierarchy. React Context would be overengineered for a single prop.

---

## Risk Assessment

| Risk                                                                         | Likelihood | Impact | Mitigation                                                                                            |
| ---------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------- |
| Set scheme editor (1205 lines) is large; changes could introduce regressions | Medium     | High   | Unit test the visibility mapping constants independently; manual testing of all 12 scheme types       |
| Staged group reveal changes `handleAddGroup` default behavior                | Low        | Medium | The change is additive (null check gates Stage 1); existing save validation catches incomplete groups |
| "Show all types" state threading through 3 levels adds prop drilling         | Low        | Low    | Bounded hierarchy; if it grows, extract to context later                                              |
| Drawer (vaul) adds a new dependency                                          | Low        | Low    | It's a standard shadcn component; consistent with existing pattern                                    |
| Category change + value preservation could cause stale form state            | Medium     | Medium | Values are preserved in React state; only UI visibility changes. Validation runs on save.             |

---

## New Dependencies

| Package                   | Version | Purpose                                         | Size  |
| ------------------------- | ------- | ----------------------------------------------- | ----- |
| `@radix-ui/react-popover` | latest  | Popover primitive for HelpTrigger large screens | ~10KB |
| `vaul`                    | latest  | Drawer primitive for HelpTrigger mobile         | ~8KB  |

Both are installed via shadcn CLI (`bunx --bun shadcn@latest add popover drawer`).

---

## Files Changed Summary

| Category         | Files                                                                             | New/Modified                    |
| ---------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| UI primitives    | `popover.tsx`, `drawer.tsx`, `help-trigger.tsx`                                   | New                             |
| Shared constants | `help-content.ts`                                                                 | New                             |
| Custom hook      | `use-media-query.ts`                                                              | New                             |
| Template builder | `session-template-form.tsx`, `activity-group-editor.tsx`, `set-scheme-editor.tsx` | Modified                        |
| Template builder | `collapsed-fields-row.tsx`                                                        | New                             |
| Program builder  | `block-editor.tsx`, `mobile-block-editor.tsx`, `program-form.tsx`                 | Modified                        |
| Styles           | `src/index.css`                                                                   | Modified (typography utilities) |
| **Total**        | **12 files**                                                                      | 6 new, 6 modified               |
