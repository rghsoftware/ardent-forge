# Tech Plan: Coach Program Assignment (18a-ii)

**Feature:** 003-coach-program-assignment
**Status:** Draft
**Date:** 2025-04-02

---

## Architecture Overview

The operation is two `UPDATE` statements (programs, session_templates) executed inside a transaction. The core challenge is that neither the Supabase path is handled by existing RLS policies. A Postgres `SECURITY DEFINER` RPC function is required on the Supabase side. The Tauri/SQLite path follows the established `pool.begin()` transaction pattern with inline role validation.

```
UI (AssignProgramDialog)
  -> useAssignProgram() hook
    -> DataAdapter.assignProgramToMember(programId, memberId, groupId)
      -> SupabaseAdapter: client.rpc('assign_program_to_member', ...)
         [Postgres function: validate coach role, UPDATE programs, UPDATE session_templates]
      -> TauriAdapter: invoke('assign_program_to_member', ...)
         [Rust command: validate coach role, tx.begin(), UPDATE x2, tx.commit()]
```

---

## Key Decisions

### Decision 1: SECURITY DEFINER RPC for Supabase path

**Problem:** The existing RLS policies block the ownership transfer in both directions:
- `programs_update` (base): `USING (user_id = auth.uid())` -- pre-update check passes (coach owns), but implicit WITH CHECK fails because the new `user_id = member != auth.uid()`.
- `programs_coach_update`: `USING (member_gm.user_id = programs.user_id AND member_gm.role = 'MEMBER')` -- pre-update USING fails because the program's current `user_id = coach` who is not a MEMBER.
- Same gap exists on `session_templates`.

Adding new RLS policies to cover this case is possible but fragile -- the update crosses the ownership boundary in both the USING (current state) and WITH CHECK (new state) evaluations simultaneously.

**Decision:** Implement a `SECURITY DEFINER` Postgres function `assign_program_to_member(p_program_id, p_target_user_id, p_group_id)` that:
1. Validates `auth.uid()` is COACH in `p_group_id`
2. Validates `p_target_user_id` is MEMBER in `p_group_id`
3. Validates the program is currently owned by `auth.uid()`
4. Executes both UPDATE statements in an implicit transaction
5. Raises an exception (which the adapter surfaces as an error) on any validation failure

This is the first `SECURITY DEFINER` function in the codebase. It is appropriate here because the operation is a deliberate ownership transfer that intentionally crosses the RLS boundary, and the function performs all authorization checks internally.

**Trade-off:** `SECURITY DEFINER` functions run with elevated privileges. The internal validation guards must be correct. The function should be narrow -- no SELECT returning user data, only UPDATE + validation logic.

---

### Decision 2: Adapter method returns `Program` (not `ProgramFull`)

The post-assignment state of the program tree is identical to pre-assignment except `user_id` changed. Re-fetching the full tree is unnecessary. The RPC function returns the updated program row; the adapter maps it to a `Program` domain object.

**Interface addition:**
```typescript
assignProgramToMember(programId: string, memberId: string, groupId: string): Promise<Program>
```

---

### Decision 3: Tauri command belongs in `programs.rs` (not `sharing.rs`)

The operation is primarily a program mutation. Coach/member validation is inline, same as `create_program_full` could do (and analogous to `update_member_role` in `sharing.rs`). The command is placed in `programs.rs` for colocation with the rest of the program commands.

---

## Stack-Specific Details

### Supabase: Migration + RPC function

**File:** `supabase/migrations/20260402000001_assign_program_to_member_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION assign_program_to_member(
    p_program_id   UUID,
    p_target_user_id UUID,
    p_group_id     UUID
)
RETURNS programs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_program   programs;
BEGIN
    -- Validate caller is COACH in the group
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
          AND user_id = v_caller_id
          AND role = 'COACH'
    ) THEN
        RAISE EXCEPTION 'unauthorized: caller is not a coach in this group';
    END IF;

    -- Validate target is MEMBER in the group
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
          AND user_id = p_target_user_id
          AND role = 'MEMBER'
    ) THEN
        RAISE EXCEPTION 'unauthorized: target user is not a member of this group';
    END IF;

    -- Validate program is owned by caller
    IF NOT EXISTS (
        SELECT 1 FROM programs
        WHERE id = p_program_id
          AND user_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'not_found: program not found or not owned by caller';
    END IF;

    -- Update session_templates referenced by this program
    UPDATE session_templates
    SET user_id = p_target_user_id
    WHERE id IN (
        SELECT ss.session_template_id
        FROM scheduled_sessions ss
        JOIN block_weeks bw ON ss.block_week_id = bw.id
        JOIN blocks b ON bw.block_id = b.id
        WHERE b.program_id = p_program_id
          AND ss.session_template_id IS NOT NULL
    );

    -- Update program ownership
    UPDATE programs
    SET user_id = p_target_user_id
    WHERE id = p_program_id
    RETURNING * INTO v_program;

    RETURN v_program;
END;
$$;

REVOKE ALL ON FUNCTION assign_program_to_member FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assign_program_to_member TO authenticated;
```

**Note:** `SET search_path = public` prevents schema injection. `REVOKE ... FROM PUBLIC` + `GRANT ... TO authenticated` restricts the function to authenticated users only.

### Supabase Adapter: `src/lib/supabase-adapter.ts`

Add after `deleteProgram`:

```typescript
async assignProgramToMember(
  programId: string,
  memberId: string,
  groupId: string
): Promise<Program> {
  const { data, error } = await this.client.rpc('assign_program_to_member', {
    p_program_id: programId,
    p_target_user_id: memberId,
    p_group_id: groupId,
  })
  if (error) throw error
  return toProgram(data)
}
```

### Tauri: Rust command `src-tauri/src/commands/programs.rs`

Add new command (after `delete_program`):

```rust
#[tauri::command]
pub async fn assign_program_to_member(
    pool: State<'_, SqlitePool>,
    caller_id: String,
    program_id: String,
    member_id: String,
    group_id: String,
) -> Result<ProgramRow, AppError> {
    // Validate caller is COACH in the group
    let caller_role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&group_id)
    .bind(&caller_id)
    .fetch_optional(pool.inner())
    .await?;

    match caller_role.as_deref() {
        Some("COACH") => {}
        _ => return Err(AppError::unauthorized("caller is not a coach in this group")),
    }

    // Validate target is MEMBER in the group
    let member_role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&group_id)
    .bind(&member_id)
    .fetch_optional(pool.inner())
    .await?;

    match member_role.as_deref() {
        Some("MEMBER") => {}
        _ => return Err(AppError::unauthorized("target user is not a member of this group")),
    }

    // Validate program is owned by caller
    let owned = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM programs WHERE id = ? AND user_id = ?",
    )
    .bind(&program_id)
    .bind(&caller_id)
    .fetch_one(pool.inner())
    .await?;

    if owned == 0 {
        return Err(AppError::not_found("program not found or not owned by caller"));
    }

    let mut tx = pool.begin().await?;

    sqlx::query(
        "UPDATE session_templates SET user_id = ?
         WHERE id IN (
             SELECT ss.session_template_id
             FROM scheduled_sessions ss
             JOIN block_weeks bw ON ss.block_week_id = bw.id
             JOIN blocks b ON bw.block_id = b.id
             WHERE b.program_id = ?
               AND ss.session_template_id IS NOT NULL
         )",
    )
    .bind(&member_id)
    .bind(&program_id)
    .execute(&mut *tx)
    .await?;

    let program = sqlx::query_as::<_, ProgramRow>(
        "UPDATE programs SET user_id = ? WHERE id = ? RETURNING *",
    )
    .bind(&member_id)
    .bind(&program_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(program)
}
```

**`src-tauri/src/lib.rs`:** Add `commands::programs::assign_program_to_member` to `invoke_handler`.

### TauriAdapter: `src/lib/tauri-adapter.ts`

Add after `deleteProgram`:

```typescript
async assignProgramToMember(
  programId: string,
  memberId: string,
  groupId: string
): Promise<Program> {
  const callerId = useAuthStore.getState().userId
  const row = await invoke<ProgramRow>('assign_program_to_member', {
    callerId,
    programId,
    memberId,
    groupId,
  })
  return toProgram(row)
}
```

### DataAdapter Interface: `src/lib/data-adapter.ts`

Add to the `DataAdapter` interface (after `deleteProgram`):

```typescript
assignProgramToMember(programId: string, memberId: string, groupId: string): Promise<Program>
```

### Hook: `src/hooks/use-programs.ts`

```typescript
export function useAssignProgram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      programId,
      memberId,
      groupId,
    }: { programId: string; memberId: string; groupId: string }) =>
      getAdapter().assignProgramToMember(programId, memberId, groupId),
    onSuccess: (_, { programId }) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] })
      queryClient.invalidateQueries({ queryKey: ['program-full', programId] })
    },
  })
}
```

### UI: `src/components/groups/assign-program-dialog.tsx`

New component. Props: `{ member: GroupMember; groupId: string; coachUserId: string }`.

Uses:
- `usePrograms(coachUserId)` to list programs the coach owns
- `useAssignProgram()` for the mutation
- `Dialog` / `DialogContent` / `DialogTrigger` (shadcn/ui) -- matches `group-create-dialog.tsx` pattern
- A program list inside the dialog (name, duration, block count) with a "Assign" button per row
- Confirmation step: after clicking "Assign," show "Assign [name] to [member]?" with Cancel/Confirm

**Integration:** Add an "Assign Program" icon button to `MemberCard` inside the coach-only action block (`isCoach && !isCurrentUser`), alongside the existing role-toggle and remove-member buttons.

---

## Integration Points

| Area | File | Change |
|------|------|--------|
| Supabase migration | `supabase/migrations/20260402000001_assign_program_to_member_rpc.sql` | New RPC function |
| DataAdapter interface | `src/lib/data-adapter.ts` | Add `assignProgramToMember` method |
| SupabaseAdapter | `src/lib/supabase-adapter.ts` | Implement `assignProgramToMember` via `.rpc()` |
| TauriAdapter | `src/lib/tauri-adapter.ts` | Implement `assignProgramToMember` via `invoke()` |
| Rust commands | `src-tauri/src/commands/programs.rs` | Add `assign_program_to_member` command |
| Rust registration | `src-tauri/src/lib.rs` | Register new command in `invoke_handler` |
| Hook | `src/hooks/use-programs.ts` | Add `useAssignProgram()` |
| UI component | `src/components/groups/assign-program-dialog.tsx` | New dialog component |
| UI integration | `src/components/groups/member-card.tsx` | Add trigger button + dialog |

---

## Risks and Unknowns

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `SECURITY DEFINER` function has incorrect validation logic | Low | Thorough exception cases in Rust-side validation serve as a secondary reference; test with RLS-enabled client |
| `session_template_id` is NULL on some scheduled_sessions | Known, handled | The SQL uses `IS NOT NULL` filter; templates are optional per the schema |
| `auth.uid()` unavailable in RPC context (anon call) | Low | `GRANT ... TO authenticated` rejects unauthenticated callers before execution |
| Coach's program is currently active for the coach | Possible | After assignment, the coach's `active_program` record still references the program by ID; it should be cleared. Add `clearActiveProgram(coachId)` call before/after assignment in the adapter if `programId` matches coach's active program. Verify against `getActiveProgram` in the adapter. |

---

## Notification (S1 -- Should Have)

The current notification system (`src/lib/notification-service.ts`) covers rest timers, session reminders, and PR celebrations. "COACH ASSIGNED PROGRAM" is a new notification category. However, the notification system is local-only (browser/Tauri push notifications for the current user). The member receiving the assignment is a different user -- cross-user push delivery would require a Supabase Realtime subscription or a Postgres trigger inserting into a `notifications` table.

For this iteration, the notification is deferred to a future step (alongside the broader notifications table design). The TA-9 assertion is marked as out-of-scope for this implementation.

---

## ADR

**ADR: Use SECURITY DEFINER RPC for ownership-transfer operations**

Captured in this Tech.md. Should be promoted to a formal ADR in `Context/Decisions/` if the pattern is reused for other ownership-transfer operations (e.g., the deferred createProgramFull/updateProgramFull atomic migration referenced in the TODO comments in supabase-adapter.ts).
