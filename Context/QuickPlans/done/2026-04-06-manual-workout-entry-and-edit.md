# Manual Workout Entry & Edit

## Task

Add a form-style logger for entering completed workouts retroactively, plus
the ability to edit existing logged sessions. Distinct from the real-time
active-session UI (`src/routes/_authenticated/log.$workoutId.tsx` + the
active-workout Zustand store) — this is a static form that writes directly
through `useWorkoutLogs` mutations with a user-supplied `startedAt` /
`completedAt`.

## Goal

- Users can record a workout they already completed (any past date/time) without
  starting a real-time session.
- Users can edit any previously logged workout (sets, exercises, notes, dates).
- Field parity with live logging: weight, reps, RPE, tempo, rest, notes,
  bodyweight, perceived difficulty, overall notes.
- Ad-hoc entry: no template required; template picker available as an optional
  starting scaffold.
- Reachable from both Forge (`/`) and History (`/history`).

## Out of Scope

- Bulk import / CSV
- Scheduled future workouts
- Edit history / audit trail (just bump `updated_at`)
- Delete (already exists at `src/components/history/delete-workout-dialog.tsx`,
  surfaced from history detail — verify it's also surfaced from the new edit
  form for parity, but no new delete logic)
- Fixing the pre-existing broken imports in `log.$workoutId.tsx`
  (`push-to-display-button`, `rest-timer-overlay`) — leftover from F018/F019,
  not part of this feature

## Approach

### Data layer

1. **Reuse existing mutations.** `src/hooks/use-workout-logs.ts` should already
   expose create + update flows backing the `workout_sessions` /
   `logged_activity_groups` / `logged_activities` / `logged_sets` tables via
   `data-adapter`. Audit it first; extend only if a full nested-write or
   nested-update mutation doesn't already exist. Prefer adding a single
   `upsertWorkoutLogFull(input)` adapter method (Tauri + Supabase) over
   sprinkling save logic in the form.
2. **Domain validation.** Reuse `workoutLogSchema` from
   `src/domain/types/workout-log.ts`. The existing `.refine()` already
   guarantees `completedAt > startedAt`. For manual entry, force
   `completedAt` to be set (form should require it) and reject future dates
   in form-level Zod refinement (not in the domain schema — keep that
   permissive for in-progress sessions).
3. **`updated_at` bump.** Edit path goes through the standard update mutation;
   `data-mapper` already stamps `updated_at` on writes. No new audit fields.

### UI: shared form component

Create `src/components/workout/manual-workout-form.tsx`:

- Single form for both create and edit. Props:
  `{ mode: 'create' | 'edit', initialValue?: WorkoutLogFull, onSaved: (id) => void }`.
- React Hook Form + Zod resolver, matching project conventions in
  `.claude/rules/react-typescript.md`.
- Sections (collapsible, dense per Iron & Ember):
  - **Session meta**: title, started-at datetime (required), completed-at
    datetime (required for manual entry), bodyweight, perceived difficulty,
    overall notes, optional template picker (hydrates blocks/exercises).
  - **Blocks** (groups): add/remove/reorder (use existing block builder
    primitives if any exist under `src/components/workout/`; otherwise build a
    minimal repeater). Each block has type (`STRAIGHT` / `SUPERSET` / etc.
    from `groupTypeSchema`), ordinal, optional rounds/time.
  - **Exercises** within a block: exercise picker (reuse
    `add-exercise-sheet.tsx` if extractable; otherwise wrap), notes, ordinal.
  - **Sets** per exercise: set type, reps, weight, duration, distance, RPE,
    rest, ruckLoad/elevation when applicable, notes, completed flag (default
    true for manual entry).
- Submit calls the create/update mutation, then `onSaved(workoutId)`.
- Honor `prefers-reduced-motion`; touch targets ≥48px; ALL-CAPS only on
  section headers per typography memory.

### Routes

1. **`/log/new`** — `src/routes/_authenticated/log.new.tsx`
   - Renders `<ManualWorkoutForm mode="create" />`.
   - On save, navigate to `/history/$workoutId`.
   - Default `startedAt` / `completedAt` to "now" but allow any past time.

2. **`/log/$workoutId/edit`** — `src/routes/_authenticated/log.$workoutId.edit.tsx`
   - Loads via `useWorkoutLogFull(workoutId)`.
   - Renders `<ManualWorkoutForm mode="edit" initialValue={data} />`.
   - On save, navigate back to `/history/$workoutId`.
   - Loading + error states per `.claude/rules/error-handling.md`
     (`isError` handling required).

### Entry points

1. **Forge page** (`src/routes/_authenticated/index.tsx`)
   - Add a secondary action near the existing "Start workout" CTA: "Log past
     workout" → links to `/log/new`. Subordinate visual weight (ember reserved
     for primary CTA per design memory).

2. **History page** (`src/routes/_authenticated/history/index.tsx`)
   - Header `+` button → `/log/new`.
   - Per-card `Edit` action (icon button on `workout-history-card.tsx` or via
     a row menu) → `/log/$workoutId/edit`.

3. **History detail** (`src/routes/_authenticated/history/$workoutId.tsx`)
   - Add "Edit" button next to existing Delete action → `/log/$workoutId/edit`.

### Tests

- `src/components/workout/__tests__/manual-workout-form.test.tsx`
  - Create flow: fills required fields, submits, mutation called with correct
    payload, future-date rejected, `completedAt < startedAt` rejected.
  - Edit flow: hydrates from `initialValue`, dirty-tracking, submit calls
    update mutation with merged value.
  - Ad-hoc + template-picker scaffolding both work.
- `src/hooks/__tests__/use-workout-logs.test.ts`
  - Extend if a new `upsertWorkoutLogFull` is added — happy path + validation
    failure path.

## Verification

- [ ] `bun run lint && bun run build` clean (ignoring the pre-existing
      `log.$workoutId.tsx` errors called out in scope).
- [ ] `bun run test` passes; new tests cover create + edit + validation paths.
- [ ] Manually: create a workout dated 3 days ago via `/log/new`, confirm it
      appears in `/history` with the correct date and contributes to analytics
      / streaks the same as a live-logged session.
- [ ] Manually: open an existing session, edit a set's weight, save, confirm
      `updated_at` advances and history detail reflects the change.
- [ ] Manually: verify Forge "Log past workout" + History `+` + per-row Edit +
      detail Edit all reach the right route.
- [ ] Color-blind / glove-usability check on the form: 48px touch targets,
      no color-only state, dense but not cramped.
- [ ] Typography: ALL-CAPS reserved for section headers/badges; mixed case for
      labels/buttons/copy (per typography memory).

## Risks

1. **Active-session store collision.** The new routes must NEVER touch
   `useActiveWorkoutStore`. Crash recovery, pause state, and rest timers are
   active-session concerns and must be inert here. Easy to accidentally pull
   in via shared components — audit any reused subcomponent for
   `useActiveWorkoutStore` references before importing.
2. **Nested write atomicity.** `workout_sessions` + groups + activities + sets
   span 4 tables. Verify the existing adapter path is transactional (Supabase
   RPC or single mutation) — if it isn't, partial writes on failure will
   leave orphaned rows. May need to wrap in an RPC or accept the risk and
   add cleanup on error.
3. **Edit-mode delete/reorder complexity.** Removing a set or reordering
   blocks in edit mode requires a diff against `initialValue` so the adapter
   knows what to delete vs. update vs. insert. Simplest path: delete-all
   then re-insert children on save (acceptable since `workout_sessions` is
   the only stable parent ID). Confirm no FKs reference logged_set IDs from
   elsewhere (analytics, PR detection) — `pr-detection.ts` is a candidate to
   audit.
4. **Domain schema permissiveness.** `workoutLogSchema.completedAt` is
   optional (in-progress sessions). Manual-entry form-level validation must
   require it; do not change the domain schema.
5. **Date pickers on mobile/Tauri.** Ensure the chosen datetime input works
   on the Tauri WebView and doesn't rely on a desktop-only widget. Native
   `<input type="datetime-local">` is the safest baseline.
6. **Future date silently allowed.** Without explicit form-level guard, a
   typo like `2027` would create a phantom future session. Reject in form
   Zod refinement.
