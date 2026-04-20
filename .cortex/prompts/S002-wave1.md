You are builder-rust, the Rust/Tauri specialist on this team.

FEATURE CONTEXT:
Read these files before starting work:
- Context/Features/024-Frequent-Exercises-Add-Picker/Spec.md -- requirements
- Context/Features/024-Frequent-Exercises-Add-Picker/Tech.md -- architecture decisions (sections 4 and Tauri adapter)
- CLAUDE.md -- project conventions
- .claude/rules/error-handling.md -- error handling conventions

YOUR TASKS:

## S002: Rust command + TauriAdapter TypeScript

### Part 1: Rust command

1. Find where existing Tauri commands live (look in `src-tauri/src/`). Find `get_recently_used_exercise_ids` -- use it as an exact template for placement and registration pattern.

2. Add the new command in the same file/location:
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

3. Register `get_frequent_exercise_ids` in the `tauri::Builder` `.invoke_handler()` list, exactly as `get_recently_used_exercise_ids` is registered.

IMPORTANT: Check the actual sqlx query type carefully. If `exercise_id` comes back as `Option<String>` from sqlx, use `.filter_map(|r| r.exercise_id.clone()).collect()` instead. Adapt to match the actual schema.

### Part 2: TauriAdapter TypeScript

1. Read `src/lib/tauri-adapter.ts` and find `getRecentlyUsedExerciseIds`. Add `getFrequentExerciseIds` immediately after it:
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

   Match the exact `invokeCommand` call pattern used by `getRecentlyUsedExerciseIds`.

## S002-T: Tests for TauriAdapter getFrequentExerciseIds

Find the TauriAdapter test file (look in `src/lib/__tests__/` or similar). Add tests for `getFrequentExerciseIds`:

1. **Forwarding test**: mock `invokeCommand` to return `['id-1', 'id-2']`; call `getFrequentExerciseIds('user-123', 5, 60)`; assert `invokeCommand` was called with `('get_frequent_exercise_ids', { user_id: 'user-123', limit: 5, window_days: 60 })` and the array is returned.
2. **Default params test**: call `getFrequentExerciseIds('user-123')` with no optional args; assert `invokeCommand` was called with `limit: 8, window_days: 90`.

Look at how `getRecentlyUsedExerciseIds` is tested in the TauriAdapter test file for the mock pattern.

FILES YOU OWN (only modify these):
- `src-tauri/src/<commands file>` (add Rust command + register)
- `src/lib/tauri-adapter.ts` (add TypeScript method only)
- The TauriAdapter test file (add tests only, do not modify existing tests)

UPSTREAM CONTRACTS:
None -- you are producing the Tauri half of the data layer.

CONTRACTS YOU MUST PRODUCE:
None -- TauriAdapter is consumed by the app at runtime; no compile-time contract needed for downstream agents.

COORDINATION (event log):
- When S002 is done (Rust + TauriAdapter TS), run:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-rust --type task_done --task S002
- When S002-T tests are done, run:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-rust --type task_done --task S002-T
- If you hit a blocker you cannot resolve, run:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-rust --type error --note "<short reason>"

After both S002 and S002-T are done, emit:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-rust --type milestone_reached --note "M1-rust-done"

Use TaskUpdate to mark tasks #14 (S002) and #16 (S002-T) as completed when done.

Think hard and provide thorough implementation. Read existing code before writing -- match patterns exactly.
