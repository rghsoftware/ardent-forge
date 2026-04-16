# Technical Plan: Feature 024 -- Frequent Exercises Add Picker

## Architecture Overview

The feature adds a frequency-ranked exercise list to the top of `ExercisePickerPanel`
when the search field is empty. It introduces one new SQL function (Supabase migration),
one new Rust Tauri command (offline path), one new adapter interface method, and one new
React hook. No existing interfaces are broken; `ExercisePickerPanel` gains one optional
prop.

```
Auth boundary prefetch
        │
        ▼
useFrequentExercises(userId)          ← new hook
        │
        ▼
adapter.getFrequentExerciseIds(...)   ← new interface method
        │
   ┌────┴────┐
   ▼         ▼
Supabase   Tauri
  RPC       Rust command
get_frequent_  get_frequent_
exercise_ids   exercise_ids
```

Resolved IDs are cross-referenced against the in-memory `allExercises` cache (already
held by `useExercises`) so no second network fetch is needed.

---

## Key Decisions

### ADR: Server-side aggregation via RPC (not client-side JS)

**Context:** Frequency is computed as completed-set count per exercise_id, joined across
`logged_activities` → `logged_activity_groups` → `workout_logs` within a 90-day window.
An active athlete may have 500-2,000 `logged_activities` rows; transferring all of them
to aggregate in JavaScript adds latency and unnecessary data transfer on every session
start.

**Decision:** New Supabase SQL function `get_frequent_exercise_ids(uid uuid, lim int, window_days int)`
returns a sorted array of exercise IDs. The Tauri adapter mirrors it with a new Rust command
of the same name.

**Consequences:**
1. A new migration (`supabase/migrations/`) must be written and applied to every environment.
2. A new Rust command (`src-tauri/src/`) must be implemented and compiled into the Tauri
   binary -- this extends the Rust scope of the feature.

**Alternatives rejected:**
- Client-side aggregation: too much data transferred for an 8-item list.
- Extending `getRecentlyUsedExerciseIds`: breaks an existing interface and conflates recency with frequency.

---

## Implementation Details

### 1. Supabase Migration

New file: `supabase/migrations/<timestamp>_add_get_frequent_exercise_ids.sql`

```sql
CREATE OR REPLACE FUNCTION get_frequent_exercise_ids(
  uid        uuid,
  lim        int  DEFAULT 8,
  window_days int DEFAULT 90
)
RETURNS TABLE(exercise_id uuid, set_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    la.exercise_id,
    COUNT(ls.id) AS set_count
  FROM logged_activities la
  JOIN logged_activity_groups lag ON la.logged_group_id = lag.id
  JOIN workout_logs wl ON lag.workout_log_id = wl.id
  LEFT JOIN logged_sets ls
    ON ls.logged_activity_id = la.id
    AND ls.completed = true
  WHERE wl.user_id = uid
    AND wl.started_at >= (NOW() - make_interval(days => window_days))
  GROUP BY la.exercise_id
  ORDER BY set_count DESC
  LIMIT lim;
$$;
```

**Index assessment:** Existing indexes cover this query:
- `idx_workout_logs_user_started ON workout_logs(user_id, started_at DESC)` -- covers the
  `WHERE wl.user_id = uid AND wl.started_at >= ...` filter.
- `idx_logged_activities_exercise ON logged_activities(exercise_id)` -- covers the GROUP BY.
No new index needed.

### 2. Adapter Interface

In `src/lib/workout-adapter.ts` (or wherever the shared interface is defined), add:

```typescript
getFrequentExerciseIds(
  userId: string,
  limit?: number,
  windowDays?: number
): Promise<string[]>
```

Returns IDs ordered by descending set count. Callers resolve to full `Exercise` objects
via the in-memory exercise cache.

### 3. SupabaseAdapter Implementation

In `src/lib/supabase-adapter.ts`:

```typescript
async getFrequentExerciseIds(
  userId: string,
  limit = 8,
  windowDays = 90,
): Promise<string[]> {
  const { data, error } = await this.client.rpc('get_frequent_exercise_ids', {
    uid: userId,
    lim: limit,
    window_days: windowDays,
  })
  if (error) {
    console.error('[supabase-adapter] getFrequentExerciseIds failed:', { userId, error })
    return []
  }
  return (data as Array<{ exercise_id: string }>).map((r) => r.exercise_id)
}
```

Error returns `[]` (graceful degradation -- picker works without suggestions).

### 4. TauriAdapter Implementation

New Rust command in `src-tauri/src/` (exact file per existing command placement):

```rust
#[tauri::command]
async fn get_frequent_exercise_ids(
    user_id: String,
    limit: Option<i64>,
    window_days: Option<i64>,
    db: tauri::State<'_, AppDatabase>,
) -> Result<Vec<String>, String> {
    let lim = limit.unwrap_or(8);
    let window = window_days.unwrap_or(90);
    // SQLite equivalent of the Supabase RPC
    let rows = sqlx::query!(
        r#"
        SELECT la.exercise_id, COUNT(ls.id) as set_count
        FROM logged_activities la
        JOIN logged_activity_groups lag ON la.logged_group_id = lag.id
        JOIN workout_logs wl ON lag.workout_log_id = wl.id
        LEFT JOIN logged_sets ls
          ON ls.logged_activity_id = la.id AND ls.completed = 1
        WHERE wl.user_id = ?
          AND wl.started_at >= datetime('now', '-' || ? || ' days')
        GROUP BY la.exercise_id
        ORDER BY set_count DESC
        LIMIT ?
        "#,
        user_id, window, lim
    )
    .fetch_all(db.pool())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.iter().map(|r| r.exercise_id.clone()).collect())
}
```

Register in `tauri::Builder` alongside existing commands.

TauriAdapter TypeScript side:

```typescript
async getFrequentExerciseIds(
  userId: string,
  limit = 8,
  windowDays = 90,
): Promise<string[]> {
  return invokeCommand<string[]>('get_frequent_exercise_ids', {
    user_id: userId,
    limit,
    window_days: windowDays,
  })
}
```

### 5. `useFrequentExercises` Hook

New file: `src/hooks/use-frequent-exercises.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useAdapter } from '@/lib/adapter'
import { useExercises } from '@/hooks/use-exercises'
import type { Exercise } from '@/domain/types'

const FREQUENT_LIMIT = 8
const FREQUENT_WINDOW_DAYS = 90
const STALE_TIME = 5 * 60 * 1000 // 5 minutes

export function useFrequentExercises(userId: string | undefined) {
  const { data: allExercises = [] } = useExercises()
  const adapter = useAdapter()

  return useQuery({
    queryKey: ['exercises', 'frequent', userId],
    queryFn: async () => {
      if (!userId) return []
      const ids = await adapter.getFrequentExerciseIds(userId, FREQUENT_LIMIT, FREQUENT_WINDOW_DAYS)
      const exerciseMap = new Map(allExercises.map((e) => [e.id, e]))
      return ids.flatMap((id) => {
        const ex = exerciseMap.get(id)
        return ex ? [ex] : []
      })
    },
    enabled: !!userId && allExercises.length > 0,
    staleTime: STALE_TIME,
  })
}
```

Query key: `['exercises', 'frequent', userId]` -- consistent with existing exercise key
pattern (`['exercises', 'recently-used', userId]`).

**Graceful degradation:** If the RPC fails, `getFrequentExerciseIds` returns `[]` → hook
returns `[]` → `ExercisePickerPanel` renders no FREQUENT section → normal search still works.

### 6. `ExercisePickerPanel` Changes

`ExercisePickerPanel` adds one optional prop:

```typescript
interface ExercisePickerPanelProps {
  // ... existing props
  frequentExercises?: Exercise[]   // pre-populated suggestions
}
```

Rendering logic (simplified):

```tsx
const showFrequent = !searchQuery && (frequentExercises?.length ?? 0) > 0

{showFrequent && (
  <div>
    <p className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-warm-ash/60">
      Frequent
    </p>
    {frequentExercises!.map((ex) => (
      <ExercisePickerRow key={ex.id} exercise={ex} onSelect={onExerciseSelected} />
    ))}
  </div>
)}

{/* existing search results list */}
{filteredExercises.map(...)}
```

The section header uses the same ALL-CAPS tracking style as workout logger column headers.
No border divider -- tonal shift via background (`bg-surface-pit/40`) if a visual break
is needed.

### 7. `AddExerciseSheet` Integration

`AddExerciseSheet` receives `userId` already. Wire `useFrequentExercises`:

```tsx
const { data: frequentExercises = [] } = useFrequentExercises(userId)

<ExercisePickerPanel
  ...existingProps
  frequentExercises={frequentExercises}
/>
```

### 8. Prefetch on Auth

In the authenticated layout (`src/routes/_authenticated.tsx` or equivalent),
prefetch the frequent exercises query so data is ready before the user opens
the picker for the first time:

```typescript
const queryClient = useQueryClient()
const { data: session } = useSession()

useEffect(() => {
  if (session?.user?.id) {
    queryClient.prefetchQuery({
      queryKey: ['exercises', 'frequent', session.user.id],
      queryFn: () => adapter.getFrequentExerciseIds(session.user.id, 8, 90),
      staleTime: STALE_TIME,
    })
  }
}, [session?.user?.id])
```

---

## Risks and Unknowns

| Risk | Likelihood | Mitigation |
|---|---|---|
| Rust command integration complexity | Medium | Follow `get_recently_used_exercise_ids` as a template -- same pattern |
| RPC permission (SECURITY DEFINER vs INVOKER) | Low | Use SECURITY DEFINER + RLS check on wl.user_id = uid |
| Frequent list stale across long sessions | Low | 5-minute staleTime + background refetch on window focus (TanStack default) |
| No `logged_activity_groups.workout_log_id` FK column | Low | Research confirmed join chain works in existing `getRecentlyUsedExerciseIds` |

---

## Files Changed Summary

| File | Change |
|---|---|
| `supabase/migrations/<ts>_add_get_frequent_exercise_ids.sql` | New migration |
| `src-tauri/src/<commands file>` | New Rust command |
| `src/lib/supabase-adapter.ts` | New `getFrequentExerciseIds` method |
| `src/lib/tauri-adapter.ts` | New `getFrequentExerciseIds` method |
| `src/lib/workout-adapter.ts` (interface) | New method signature |
| `src/hooks/use-frequent-exercises.ts` | New hook |
| `src/components/workout/exercise-picker-panel.tsx` | `frequentExercises` prop + FREQUENT section |
| `src/components/workout/add-exercise-sheet.tsx` | Wire `useFrequentExercises` |
| `src/routes/_authenticated.tsx` (or layout) | Prefetch call |

---

## Revision History

| Date       | Change       | ADR |
|------------|--------------|-----|
| 2026-04-16 | Initial tech plan | ADR: server-side RPC aggregation accepted |
