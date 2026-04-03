# Implementation Steps: Coach Program Assignment (18a-ii)

**Feature:** 003-coach-program-assignment
**Step:** 18a-ii of implementation-plan.md
**Status:** Ready
**Date:** 2025-04-02

---

## Team Composition

| Role | Agent Type | Domains |
|------|-----------|---------|
| database-engineer | Specialist | Supabase migrations, SECURITY DEFINER RPC, Postgres |
| backend-engineer | Specialist | Rust/Tauri commands, SQLite transactions, lib.rs |
| frontend-specialist | Specialist | DataAdapter interface + adapters, TanStack Query hooks, React UI |
| quality-engineer | Validator | Cross-cutting validation against testable assertions |

---

## Wave 1: Foundation (parallel)

> **Goal:** Migration applied, interface declared, Rust command compiled. All three are independent.

### S001 -- Supabase RPC migration
- **Agent:** database-engineer
- **Parallel:** Yes (independent)
- **Files to create:** `supabase/migrations/20260402000001_assign_program_to_member_rpc.sql`
- **Work:**
  1. Create `SECURITY DEFINER` function `assign_program_to_member(p_program_id UUID, p_target_user_id UUID, p_group_id UUID) RETURNS programs`
  2. Internal validation (raise exception on failure):
     - `auth.uid()` is COACH in `p_group_id` (query `group_members`)
     - `p_target_user_id` is MEMBER in `p_group_id` (query `group_members`)
     - Program exists and `user_id = auth.uid()` (query `programs`)
  3. Update session_templates: `UPDATE session_templates SET user_id = p_target_user_id WHERE id IN (SELECT ss.session_template_id FROM scheduled_sessions ss JOIN block_weeks bw ON ss.block_week_id = bw.id JOIN blocks b ON bw.block_id = b.id WHERE b.program_id = p_program_id AND ss.session_template_id IS NOT NULL)`
  4. Update program: `UPDATE programs SET user_id = p_target_user_id WHERE id = p_program_id RETURNING * INTO v_program`
  5. `SET search_path = public` on function definition
  6. `REVOKE ALL ON FUNCTION assign_program_to_member FROM PUBLIC`
  7. `GRANT EXECUTE ON FUNCTION assign_program_to_member TO authenticated`
- **Acceptance:**
  - Migration applies cleanly with `npx supabase db push`
  - Direct RPC call as a COACH in a shared group succeeds and returns updated program row
  - Call as a non-coach fails with "unauthorized" exception
  - Call for a program not owned by caller fails with "not_found" exception
  - Call targeting a user who is not a member of the group fails with "unauthorized" exception
- **Depends on:** Nothing

### S002 -- DataAdapter interface
- **Agent:** frontend-specialist
- **Parallel:** Yes (independent of S001, S003)
- **Files to modify:** `src/lib/data-adapter.ts`
- **Work:**
  1. Add to the `DataAdapter` interface after `deleteProgram`:
     ```typescript
     assignProgramToMember(programId: string, memberId: string, groupId: string): Promise<Program>
     ```
  2. No other changes -- interface only.
- **Acceptance:**
  - `bun run build` compiles without errors (both adapter implementations will fail until S004/S005 -- that's expected during Wave 1)
  - Actually: just verify TypeScript accepts the interface addition in isolation
- **Depends on:** Nothing

### S003 -- Rust command + registration
- **Agent:** backend-engineer
- **Parallel:** Yes (independent of S001, S002)
- **Files to modify:** `src-tauri/src/commands/programs.rs`, `src-tauri/src/lib.rs`
- **Work:**
  1. Add `assign_program_to_member` command to `programs.rs` after `delete_program`:
     - Params: `pool: State<'_, SqlitePool>`, `caller_id: String`, `program_id: String`, `member_id: String`, `group_id: String`
     - Returns: `Result<ProgramRow, AppError>`
     - Pre-transaction validation (three queries, each with early return on failure):
       1. Fetch `role` from `group_members WHERE group_id = ? AND user_id = ?` for `caller_id`; reject if not `"COACH"`
       2. Fetch `role` from `group_members WHERE group_id = ? AND user_id = ?` for `member_id`; reject if not `"MEMBER"`
       3. `SELECT COUNT(*) FROM programs WHERE id = ? AND user_id = ?` with `program_id` and `caller_id`; reject if 0
     - Open transaction: `let mut tx = pool.begin().await?`
     - `UPDATE session_templates SET user_id = ? WHERE id IN (SELECT ss.session_template_id FROM scheduled_sessions ss JOIN block_weeks bw ON ss.block_week_id = bw.id JOIN blocks b ON bw.block_id = b.id WHERE b.program_id = ? AND ss.session_template_id IS NOT NULL)` -- bind `member_id`, `program_id`
     - `UPDATE programs SET user_id = ? WHERE id = ? RETURNING *` -- bind `member_id`, `program_id` -- fetch as `ProgramRow`
     - `tx.commit().await?`
     - Return `Ok(program)`
  2. In `src-tauri/src/lib.rs`: add `commands::programs::assign_program_to_member` to the `invoke_handler!` list in the Programs section (lines ~78-85)
- **Acceptance:**
  - `cargo build` in `src-tauri/` succeeds with no errors or warnings
  - Command appears in the registered handler list
  - Validations use the same error patterns as `update_member_role` in `sharing.rs`
- **Depends on:** Nothing

---

## Wave 2: Adapter Implementations (parallel)

> **Goal:** Both adapters implement the interface. TypeScript compiles fully.

### S004 -- SupabaseAdapter implementation
- **Agent:** frontend-specialist
- **Parallel:** Yes (can run in parallel with S005)
- **Files to modify:** `src/lib/supabase-adapter.ts`
- **Work:**
  1. Add `assignProgramToMember` method to `SupabaseAdapter` after `deleteProgram`:
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
  2. Verify `toProgram` is already imported (it is -- used by existing methods).
- **Acceptance:**
  - TypeScript compiles with no errors
  - Method signature matches the `DataAdapter` interface exactly
- **Depends on:** S001 (migration must exist for RPC name to be valid), S002 (interface must declare the method)

### S005 -- TauriAdapter implementation
- **Agent:** frontend-specialist
- **Parallel:** Yes (can run in parallel with S004)
- **Files to modify:** `src/lib/tauri-adapter.ts`
- **Work:**
  1. Add `assignProgramToMember` method to `TauriAdapter` after `deleteProgram`:
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
  2. Confirm `useAuthStore`, `invoke`, `ProgramRow`, and `toProgram` are already imported (all are used by other methods in this file).
- **Acceptance:**
  - TypeScript compiles with no errors
  - Method signature matches the `DataAdapter` interface exactly
  - `invoke` parameter keys match the Rust command's parameter names exactly (snake_case in Tauri's invoke call matches the Rust `#[tauri::command]` parameter names)
- **Depends on:** S002 (interface), S003 (Rust command must compile for Tauri invoke to be valid at runtime)

---

## Wave 3: Hook

> **Goal:** React mutation hook available for UI consumption.

### S006 -- useAssignProgram hook
- **Agent:** frontend-specialist
- **Parallel:** No (depends on Wave 2 completing)
- **Files to modify:** `src/hooks/use-programs.ts`
- **Work:**
  1. Add `useAssignProgram` after `useDeleteProgram`:
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
  2. Verify `getAdapter`, `useMutation`, `useQueryClient` are already imported (they are).
- **Acceptance:**
  - TypeScript compiles
  - `queryKey: ['programs']` invalidation matches the key used by `usePrograms`
- **Depends on:** S004, S005

---

## Wave 4: UI

> **Goal:** Coach can open the dialog, select a program, confirm, and trigger the assignment.

### S007 -- AssignProgramDialog component
- **Agent:** frontend-specialist
- **Parallel:** No (depends on S006)
- **Files to create:** `src/components/groups/assign-program-dialog.tsx`
- **Work:**
  1. Props interface: `{ member: GroupMember; groupId: string; coachUserId: string; trigger: React.ReactNode }`
  2. Internal state: `open: boolean`, `selectedProgramId: string | null`, `confirming: boolean`
  3. Data: `usePrograms(coachUserId)` -- coach's own programs
  4. Mutation: `useAssignProgram()`
  5. UI flow:
     - Step 1 (program list): Dialog with heading "Assign Program to [member display name]". List programs where `program.userId === coachUserId` (filter out any `COACH_ASSIGNED` programs where the coach is the assignee, not the author). Each row shows program name, block count, duration. Clicking a row sets `selectedProgramId` and advances to Step 2.
     - Step 2 (confirmation): "Assign [program name] to [member name]?" with Back and Confirm buttons.
     - On Confirm: call `mutate({ programId: selectedProgramId, memberId: member.userId, groupId })`. On success: close dialog, reset state. On error: show error message inside dialog (match existing error display pattern from `member-card.tsx`).
  6. Use `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` from `src/components/ui/dialog.tsx`
  7. Use `Button` from `src/components/ui/button.tsx`
  8. Match Iron & Ember design tokens (surface-iron background, ember accent for confirm button). Follow visual conventions from `group-create-dialog.tsx`.
- **Acceptance:**
  - Dialog opens when trigger is clicked
  - Program list shows only programs where `userId === coachUserId`
  - Confirmation step shows correct program and member names
  - On success, dialog closes and program list (coach's library) no longer shows the assigned program
  - On error, error message visible inside dialog without closing it
  - Loading state on Confirm button while mutation is in-flight
- **Depends on:** S006

### S008 -- MemberCard integration
- **Agent:** frontend-specialist
- **Parallel:** No (depends on S007)
- **Files to modify:** `src/components/groups/member-card.tsx`
- **Work:**
  1. Import `AssignProgramDialog` from `./assign-program-dialog`
  2. Accept `coachUserId: string` as a new prop on `MemberCard` (the `currentUserId` when `isCoach` is true -- same value, passed explicitly for clarity)
  3. Inside the coach-only action block (`isCoach && !isCurrentUser`), add `AssignProgramDialog` with:
     - `member={member}`
     - `groupId={groupId}`
     - `coachUserId={coachUserId}`
     - `trigger={<IconButton icon="assignment" title="Assign Program" />}` -- match icon style of existing swap_horiz and person_remove buttons
  4. Thread `coachUserId` down from `MembersTab` in `group-detail.tsx` (where `currentUserId` is already available as `useAuthStore.getState().userId` or similar -- verify the exact source)
- **Acceptance:**
  - "Assign Program" button visible in member card when viewer is a coach and card is not the coach's own card
  - Button not visible for coach's own card or when viewer is not a coach
  - Clicking button opens `AssignProgramDialog`
  - TA-1, TA-2, TA-3, TA-6, TA-7, TA-10 all satisfied end-to-end
- **Depends on:** S007

---

## Wave 5: Validation

### S009-T -- Quality validation
- **Agent:** quality-engineer
- **Parallel:** No (depends on all Wave 4 tasks)
- **Mode:** Validation only -- no file modifications
- **Work:** Verify each testable assertion from Spec.md:
  - **TA-1**: Inspect SupabaseAdapter and TauriAdapter -- confirm `user_id` is set to member on return value
  - **TA-2**: Confirm no UPDATE touches the coach's other programs; the SQL WHERE clause is `WHERE id = p_program_id`
  - **TA-3**: Read the SQL in S001 and S003 -- confirm session_templates are updated via the JOIN chain; confirm blocks/block_weeks/scheduled_sessions have no `user_id` column and are untouched
  - **TA-4**: Read Rust validation logic -- confirm non-coach returns `AppError::unauthorized`; read RPC function -- confirm `GRANT ... TO authenticated` and role check
  - **TA-5**: Read Rust and RPC validation -- confirm group membership check for both caller and target
  - **TA-6**: Confirm no new RLS policies restrict member write on `programs` (existing `programs_update` with `user_id = auth.uid()` will pass after transfer since member now owns it)
  - **TA-7**: Confirm `programs_coach_update` RLS policy will pass post-assignment (program's new `user_id = member` who IS a MEMBER in the coach's group -- USING clause satisfied)
  - **TA-8**: Read Rust command -- confirm transaction opens before first UPDATE and commits after second; confirm `?` propagation causes rollback on error
  - **TA-10**: Read `AssignProgramDialog` -- confirm filter on `program.userId === coachUserId`
  - **Active program risk**: Verify whether `getActiveProgram` for the coach needs to be checked and `clearActiveProgram` called if the assigned program was the coach's active program. Flag if this is unhandled.
- **Acceptance:** All assertions verified. Any gaps documented and either fixed or filed as follow-up.
- **Depends on:** S001, S002, S003, S004, S005, S006, S007, S008

---

## Milestone: Done When (from Spec.md)

- [ ] TA-1: Coach assigns program -> member's list contains it with correct ownership
- [ ] TA-2: Coach's program list no longer contains the program
- [ ] TA-3: session_templates updated; blocks/block_weeks/scheduled_sessions untouched
- [ ] TA-4: Non-coach rejected
- [ ] TA-5: Coach outside shared group rejected
- [ ] TA-6: Member can edit/delete assigned program
- [ ] TA-7: Coach can edit assigned program post-handoff
- [ ] TA-8: Partial failure rolls back (Tauri path)
- [ ] TA-10: Program picker shows only coach-owned programs
- [ ] Implementation-plan.md Step 18 Done checklist item marked complete

---

## Execution Notes

- **Run order:** Wave 1 agents launch in parallel -> Wave 2 after S001+S002 complete -> S006 after Wave 2 -> S007 after S006 -> S008 after S007 -> S009-T after S008
- **Migration timestamp:** Use `20260402000001` (next after `20260401000001_create_event_tables.sql`)
- **Active program risk (from Tech.md):** S009-T should flag if `clearActiveProgram` is needed when the assigned program is the coach's active program. If flagged, the fix belongs in the SupabaseAdapter and TauriAdapter `assignProgramToMember` methods before returning.
- **Notification (TA-9):** Deferred. Cross-user push requires a notifications table not yet designed. Remove TA-9 from this milestone.
