# Implementation Steps: Frequent Exercises Add Picker

**Spec:** Context/Features/024-Frequent-Exercises-Add-Picker/Spec.md
**Tech:** Context/Features/024-Frequent-Exercises-Add-Picker/Tech.md

## Progress
- **Status:** Not started
- **Current task:** --
- **Last milestone:** --

## Team Orchestration

### Team Members
- **builder-data**
  - Role: Data layer -- adapter interface, Supabase migration, SupabaseAdapter, useFrequentExercises hook
  - Agent Type: general-purpose
  - Resume: false
- **builder-rust**
  - Role: Rust Tauri command + TauriAdapter TypeScript implementation
  - Agent Type: general-purpose
  - Resume: false
- **builder-ui**
  - Role: Frontend UI -- ExercisePickerPanel, AddExerciseSheet, auth prefetch
  - Agent Type: general-purpose
  - Resume: false
- **validator**
  - Role: Quality validation (read-only)
  - Agent Type: general-purpose
  - Resume: false

---

## Tasks

### Phase 1: Data Layer

- [ ] S001: Add `getFrequentExerciseIds(userId: string, limit?: number, windowDays?: number): Promise<string[]>` to the adapter interface in `src/lib/data-adapter.ts`, immediately after `getRecentlyUsedExerciseIds`. Then implement in `src/lib/supabase-adapter.ts` by calling `.rpc('get_frequent_exercise_ids', { uid, lim, window_days })` and mapping the returned rows to `exercise_id` strings. Error returns `[]` (graceful degradation). Create the Supabase migration at `supabase/migrations/<timestamp>_add_get_frequent_exercise_ids.sql` with the SQL function from Tech.md section 1 (STABLE, SECURITY DEFINER, 90-day window, returns TABLE of exercise_id + set_count). Log errors with `[supabase-adapter]` prefix per error-handling conventions.
  - **Assigned:** builder-data
  - **Depends:** none
  - **Parallel:** true

- [ ] S002: Add the Rust Tauri command `get_frequent_exercise_ids` to `src-tauri/src/`. Follow `get_recently_used_exercise_ids` as the template for command placement and registration pattern. The SQLite query mirrors the Supabase SQL from Tech.md section 4 (use `datetime('now', '-' || ? || ' days')` for the window filter). Register in the `tauri::Builder` handler list. Then add the TypeScript TauriAdapter method in `src/lib/tauri-adapter.ts` calling `invokeCommand<string[]>('get_frequent_exercise_ids', { user_id, limit, window_days })` with defaults `limit=8, windowDays=90`.
  - **Assigned:** builder-rust
  - **Depends:** none
  - **Parallel:** true

- [ ] S001-T: Test SupabaseAdapter `getFrequentExerciseIds` [A-006]: fixture with 3 exercises at different set counts; assert returned order matches descending count. Test graceful degradation: when RPC returns error, method returns `[]` and logs with `[supabase-adapter]` prefix.
  - **Assigned:** builder-data
  - **Depends:** S001
  - **Parallel:** false

- [ ] S002-T: Test TauriAdapter `getFrequentExerciseIds`: mock `invokeCommand` to return a fixture array; assert the array is returned as-is. Test that `user_id`, `limit`, and `window_days` are forwarded correctly with proper defaults (8, 90).
  - **Assigned:** builder-rust
  - **Depends:** S002
  - **Parallel:** false

🏁 MILESTONE M1: Data layer complete -- adapter interface defined, both adapter implementations done, migration written

  **Verify:** A-006 (ranking order), adapter graceful degradation  
  **Contracts:**  
  - `src/lib/data-adapter.ts` -- `getFrequentExerciseIds` method signature (used by hook and both adapter implementations)

---

### Phase 2: Hook + Component (parallel)

- [ ] S003: Create `src/hooks/use-frequent-exercises.ts`. Import `useQuery` from `@tanstack/react-query`, `useAdapter` from `@/lib/adapter`, `useExercises` from `@/hooks/use-exercises`, and `Exercise` from `@/domain/types`. Query key: `['exercises', 'frequent', userId]`. Query function: call `adapter.getFrequentExerciseIds(userId, 8, 90)`, then cross-reference IDs against the in-memory `allExercises` map, returning full `Exercise` objects in ranked order. Enable only when `!!userId && allExercises.length > 0`. `staleTime: 5 * 60 * 1000`. Export `useFrequentExercises(userId: string | undefined)`.
  - **Assigned:** builder-data
  - **Depends:** S001
  - **Parallel:** true

- [ ] S003-T: Test `useFrequentExercises` [A-008, A-006]: mock adapter returning IDs in ranked order; assert hook returns full `Exercise` objects in the same order (A-008). Test that when `userId` is undefined the query is disabled. Test that when adapter returns IDs for exercises not in `allExercises` cache, those IDs are silently dropped (flatMap behavior).
  - **Assigned:** builder-data
  - **Depends:** S003
  - **Parallel:** false

- [ ] S004: Update `src/components/workout/exercise-picker-panel.tsx`:
  1. Add `frequentExercises?: Exercise[]` to `ExercisePickerPanelProps`.
  2. Derive `showFrequent = !searchQuery && (frequentExercises?.length ?? 0) > 0`.
  3. When `showFrequent`, render a FREQUENT section above the normal filtered list: section header `<p className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-warm-ash/60">Frequent</p>` followed by `frequentExercises!.map(ex => <ExercisePickerRow key={ex.id} exercise={ex} onSelect={onExerciseSelected} />)`.
  4. The FREQUENT section is hidden (not rendered) as soon as `searchQuery` has any character. No hybrid view.
  5. When `frequentExercises` is empty or undefined and `searchQuery` is empty, render an empty-state message: `<p className="px-4 py-4 text-[11px] uppercase tracking-widest text-warm-ash/40">No history yet -- start a workout to build suggestions.</p>` (covers A-003 fallback for new users).
  6. No border dividers -- tonal depth only per Iron & Ember conventions.
  - **Assigned:** builder-ui
  - **Depends:** none
  - **Parallel:** true

- [ ] S004-T: Test `ExercisePickerPanel` with `frequentExercises` prop [A-001, A-002, A-003, A-004, A-005, A-007]:
  - A-001: FREQUENT header and exercises visible when search empty and `frequentExercises` provided
  - A-002: FREQUENT section absent from DOM when user types a character; normal search results shown
  - A-003: FREQUENT absent and fallback copy shown when `frequentExercises` is empty array
  - A-004: Only 8 exercises shown even if `frequentExercises` has 20 items (mock adapter capping enforced by hook, but also assert component respects the array length -- Tech.md caps at adapter/hook level; test documents the contract)
  - A-005: Tapping a frequent exercise row calls `onExerciseSelected` with the full Exercise object
  - A-007: Exercise already in active workout still shown in FREQUENT list (no filter applied)
  - **Assigned:** builder-ui
  - **Depends:** S004
  - **Parallel:** false

🏁 MILESTONE M2: Hook and component ready

  **Verify:** A-001, A-002, A-003, A-004, A-005, A-007, A-008  
  **Contracts:**  
  - `src/hooks/use-frequent-exercises.ts` -- exported hook signature (consumed by AddExerciseSheet)  
  - `src/components/workout/exercise-picker-panel.tsx` -- updated props interface (consumed by AddExerciseSheet)

---

### Phase 3: Integration

- [ ] S005: Wire `useFrequentExercises` into `src/components/workout/add-exercise-sheet.tsx`:
  1. Import `useFrequentExercises` from `@/hooks/use-frequent-exercises`.
  2. Inside the component, add: `const { data: frequentExercises = [] } = useFrequentExercises(userId)`.
  3. Pass `frequentExercises={frequentExercises}` to `ExercisePickerPanel`.
  
  Then add the auth prefetch in `src/routes/_authenticated.tsx`:
  1. Import `useQueryClient` from `@tanstack/react-query`, `useAdapter` from `@/lib/adapter`, and the session/user hook already used in the file.
  2. Add a `useEffect` that calls `queryClient.prefetchQuery({ queryKey: ['exercises', 'frequent', userId], queryFn: () => adapter.getFrequentExerciseIds(userId, 8, 90), staleTime: 5 * 60 * 1000 })` when `userId` is available. Guard with `if (!userId) return`.
  - **Assigned:** builder-ui
  - **Depends:** S003, S004
  - **Parallel:** false

- [ ] S005-T: Integration tests for `AddExerciseSheet`: mock `useFrequentExercises` to return a fixture array; render the sheet open; assert `ExercisePickerPanel` receives the `frequentExercises` prop. Test that when `userId` is undefined, `useFrequentExercises` is called with `undefined` (query disabled at hook level).
  - **Assigned:** builder-ui
  - **Depends:** S005
  - **Parallel:** false

🏁 MILESTONE M3: All production changes done

  **Verify:** A-001 through A-008 in full; no border dividers introduced; touch targets 48px+; no silent catch blocks in new code

---

### Phase 4: Validation

- [ ] S006: Quality validation -- read-only inspection of all changed files. Verify:
  - No border dividers introduced (layout-conventions.md)
  - All catch blocks capture `err` and log with `[module-name]` prefix (error-handling.md)
  - Query key `['exercises', 'frequent', userId]` consistent across hook, prefetch, and any cache invalidation
  - `useFrequentExercises` disabled when `userId` undefined or `allExercises` empty (no premature fetch)
  - Rust command uses `Option<i64>` for optional params with correct SQLite datetime syntax
  - Migration file named with timestamp prefix and placed in `supabase/migrations/`
  - All Spec.md Must Have requirements traceable to code
  - A-003 fallback renders correctly (empty-state message, not blank)
  - **Assigned:** validator
  - **Depends:** S001-T, S002-T, S003-T, S004-T, S005-T
  - **Parallel:** false

🏁 MILESTONE M4: Feature complete -- all assertions verified, full validation pass

---

## Acceptance Criteria

- [ ] All 8 testable assertions from Spec.md verified (A-001 through A-008)
- [ ] All tests passing (`bun run test`)
- [ ] No TODO/FIXME stubs remaining
- [ ] No border dividers in new UI (tonal depth only)
- [ ] Migration file present in `supabase/migrations/`
- [ ] Rust command registered in Tauri builder
- [ ] Prefetch wired in `_authenticated.tsx`

## Validation Commands

```bash
bun run test                          # full test suite
bun run lint                          # ESLint
bun run build                         # TypeScript check + Vite build
```
