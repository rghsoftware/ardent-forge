You are builder-data, the data layer specialist on this team.

FEATURE CONTEXT:
Read these files before starting work:
- Context/Features/024-Frequent-Exercises-Add-Picker/Spec.md -- requirements and testable assertions
- Context/Features/024-Frequent-Exercises-Add-Picker/Tech.md -- architecture decisions (sections 1-3 are yours)
- CLAUDE.md -- project conventions
- .claude/rules/error-handling.md -- error handling conventions (bare catch blocks, [module-name] prefix)
- .claude/rules/typescript-conventions.md -- TypeScript conventions

YOUR TASKS:

## S001: Adapter interface + Supabase migration + SupabaseAdapter

1. Read `src/lib/data-adapter.ts` and find `getRecentlyUsedExerciseIds`. Add the new method signature immediately after it:
   ```typescript
   getFrequentExerciseIds(
     userId: string,
     limit?: number,
     windowDays?: number,
   ): Promise<string[]>
   ```

2. Read `src/lib/supabase-adapter.ts` and find the `getRecentlyUsedExerciseIds` implementation. Add `getFrequentExerciseIds` immediately after it:
   - Call `this.client.rpc('get_frequent_exercise_ids', { uid: userId, lim: limit ?? 8, window_days: windowDays ?? 90 })`
   - On error: log with `console.error('[supabase-adapter] getFrequentExerciseIds failed:', { userId, error })` and return `[]`
   - On success: return `(data as Array<{ exercise_id: string }>).map((r) => r.exercise_id)`

3. Find the latest migration timestamp in `supabase/migrations/` (look at existing filenames to get the format). Create a new migration file:
   `supabase/migrations/<timestamp>_add_get_frequent_exercise_ids.sql`

   Use the SQL from Tech.md section 1 exactly. The function signature is:
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

## S001-T: Tests for SupabaseAdapter getFrequentExerciseIds

Find the existing SupabaseAdapter test file (look in `src/lib/__tests__/` or similar). Add tests for `getFrequentExerciseIds`:

1. **A-006 ranking test**: mock `.rpc` to return 3 exercises with set counts -- the adapter just maps rows to IDs, so mock the RPC returning `[{ exercise_id: 'id-a', set_count: 10 }, { exercise_id: 'id-b', set_count: 5 }, { exercise_id: 'id-c', set_count: 3 }]`; assert returned array is `['id-a', 'id-b', 'id-c']` (order preserved from server response).
2. **Graceful degradation test**: mock `.rpc` to return `{ data: null, error: { message: 'rpc error' } }`; assert method returns `[]` and `console.error` was called with a string containing `[supabase-adapter]`.

Look at how `getRecentlyUsedExerciseIds` is tested for the mock pattern to follow.

FILES YOU OWN (only modify these):
- `src/lib/data-adapter.ts` (add interface method only)
- `src/lib/supabase-adapter.ts` (add implementation method only)
- `supabase/migrations/<timestamp>_add_get_frequent_exercise_ids.sql` (new file)
- The SupabaseAdapter test file (add tests only, do not modify existing tests)

UPSTREAM CONTRACTS:
None -- you are producing the foundation.

CONTRACTS YOU MUST PRODUCE:
- `src/lib/data-adapter.ts` -- with `getFrequentExerciseIds` method signature
  (downstream agents builder-data wave 2 and builder-ui wave 3 depend on this interface)

COORDINATION (event log):
- When S001 is done (adapter interface + migration + SupabaseAdapter), run:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-data --type task_done --task S001
- When you write `src/lib/data-adapter.ts` with the new method, run:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-data --type contract_ready --contract src/lib/data-adapter.ts
- When S001-T tests are done, run:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-data --type task_done --task S001-T
- If you hit a blocker you cannot resolve, run:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-data --type error --note "<short reason>"

After both S001 and S001-T are done, emit:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-data --type milestone_reached --note "M1-data-done"

Use TaskUpdate to mark tasks #13 (S001) and #15 (S001-T) as completed when done.

Think hard and provide thorough implementation. Read existing code before writing -- match patterns exactly.
