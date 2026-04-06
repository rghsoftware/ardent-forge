# Quick Plan: Exercises Tab on Library Page

## Task

Add an "Exercises" tab to the Library page alongside existing Templates and Programs tabs, embedding the existing exercise list/create functionality.

## Goal

Users can browse, search, filter, and create exercises directly from the Library page without navigating to the standalone `/exercises/` route.

## Approach

### 1. Expand `LibraryTab` type

- Change `type LibraryTab = 'templates' | 'programs'` to `'templates' | 'programs' | 'exercises'`

### 2. Add header button for exercises tab

- When `activeTab === 'exercises'`, show a "New exercise" button that opens `CreateExerciseSheet`
- Match the button style pattern used by Templates ("New session") and Programs ("Create program")

### 3. Add tab button in tab navigation

- Add an "EXERCISES" tab button matching the existing Templates/Programs pattern
- Uses same styling: `min-h-12 px-4 pb-3 text-xs uppercase tracking-wider`

### 4. Add exercises tab panel

- Create an `ExerciseList` component (inline in library.tsx, similar to `ProgramList`)
- Reuse existing components:
  - `ExerciseSearchInput` for search
  - `ExerciseFilterBar` for category/muscle/movement filters
  - `ExerciseListItem` for each exercise row
- Include recently-used section when no filters active (via `useRecentlyUsedExercises`)
- Include loading skeletons, error state, and empty state matching Library page patterns
- Wire `ExerciseListItem` to navigate to `/exercises/$exerciseId` for detail view

### 5. Wire up CreateExerciseSheet

- Add state: `showCreateExercise` boolean
- Import and render `CreateExerciseSheet` alongside the existing template Sheet

### Files touched

- `src/routes/_authenticated/library.tsx` -- primary changes (type, tab UI, panel, imports)
- No new files needed

### Imports to add

```typescript
import { ExerciseSearchInput } from '@/components/exercises/exercise-search-input'
import { ExerciseFilterBar } from '@/components/exercises/exercise-filter-bar'
import { ExerciseListItem } from '@/components/exercises/exercise-list-item'
import { CreateExerciseSheet } from '@/components/exercises/create-exercise-sheet'
import { useExercises, useRecentlyUsedExercises } from '@/hooks/use-exercises'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { ExerciseCategory, MuscleGroup, MovementPattern } from '@/domain/types'
```

## Verification

- [ ] Library page shows three tabs: Templates, Programs, Exercises
- [ ] Exercises tab displays search input and filter bar
- [ ] Exercise list loads and renders with category badges
- [ ] Search filters exercises by name/alias
- [ ] Category/muscle/movement filters work
- [ ] Recently used section appears when no filters active
- [ ] "New exercise" button opens CreateExerciseSheet
- [ ] Clicking an exercise navigates to `/exercises/$exerciseId`
- [ ] Loading, error, and empty states render correctly
- [ ] Existing Templates and Programs tabs still work unchanged
- [ ] TypeScript compiles cleanly (`bun run build`)

## Risks

- **Library page file size**: Adding inline `ExerciseList` increases the file further (already 692 lines). Acceptable for now since it follows the existing `ProgramList` pattern.
- **Low risk overall**: All data layer, hooks, and components are proven -- this is purely UI composition.
