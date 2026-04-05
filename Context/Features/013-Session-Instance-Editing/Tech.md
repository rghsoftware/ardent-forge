# Tech Plan: Per-Instance Scheduled Session Editing

**Spec:** Context/Features/013-Session-Instance-Editing/Spec.md
**Stacks involved:** React/TypeScript (frontend), Rust/Tauri (desktop shell + SQLite), Supabase (remote Postgres)

## Architecture Overview

This feature adds a per-instance override layer on top of the existing session-template reference model. Currently, a `ScheduledSession` is a thin pointer: it references a `SessionTemplate` by ID and stores scheduling metadata (day, label, type, notes). The workout-start flow fetches the full template and resolves it into pre-filled sets.

The new model introduces an `overrides` JSON column on `scheduled_sessions` that stores partial activity-level diffs. At rest, the column is `NULL` (no overrides). When the user customizes an activity, only the changed fields are written. At workout-start time, the override map is merged on top of the resolved template before creating workout log entries.

```
┌─────────────────────────────────────────────────┐
│                  Program Builder                 │
│                                                  │
│  Empty Slot ──click──> SessionPickerSheet        │
│  Filled Slot ─click──> SessionEditSheet (NEW)    │
│       │                    │                     │
│       │         ┌──────────┴──────────┐          │
│       │         │  Notes editor       │          │
│       │         │  Activity list      │          │
│       │         │   └─ Override form  │          │
│       │         │  Change template    │          │
│       │         │  Remove session     │          │
│       │         └─────────────────────┘          │
│       ▼                                          │
│  SessionDraft { ..., notes?, overrides? }        │
└──────────────────────┬───────────────────────────┘
                       │ save
                       ▼
              ScheduledSession row
              { ..., notes, overrides }
                       │
                       │ workout start
                       ▼
              resolveSessionTemplate()
              + applyOverrides()  (NEW)
                       │
                       ▼
              Pre-filled WorkoutLog entries
```

## Key Decisions

### Decision 1: Override Storage -- JSON Column vs Separate Table

**Options considered:**

- **Option A: `overrides` JSON column on `scheduled_sessions`** -- Single column, no joins, stores a partial diff map keyed by activity ordinal. NULL when no overrides exist.
- **Option B: Separate `session_overrides` table** -- Normalized, one row per overridden activity. Requires joins on read and cascading writes on save.

**Chosen:** Option A -- JSON column
**Rationale:** Overrides are tightly coupled to a single scheduled session and have no independent lifecycle. The data shape is small and predictable (a handful of activity overrides per session). A JSON column avoids join complexity, simplifies the save flow (one column update), and is extensible if new override types are needed later. Both SQLite (`json()` function) and Postgres (`jsonb`) handle this well.

### Decision 2: Override Key -- Activity Ordinal vs Activity ID

**Options considered:**

- **Option A: Key by `activityId` (UUID)** -- Stable across template edits that reorder activities, but requires the edit sheet to know activity IDs at display time.
- **Option B: Key by activity ordinal (1-based position)** -- Simpler, directly corresponds to the visual order in the template. Breaks if template activities are reordered after overrides are set.

**Chosen:** Option A -- Key by `activityId`
**Rationale:** Activity IDs are stable UUIDs available from `SessionTemplateFull.activities`. Keying by ordinal would silently apply overrides to the wrong exercise if the template is later reordered. Since the edit sheet already loads the full template to display activities, IDs are readily available. The trade-off is that if a template activity is deleted, the orphaned override is harmlessly ignored (no crash, just a no-op).

### Decision 3: Override JSON Shape

**Chosen shape:**

```typescript
// Domain type (Zod schema)
type ActivityOverride = {
  exerciseId?: string // replacement exercise UUID
  setScheme?: SetScheme // full replacement set scheme (any variant)
}

type SessionOverrides = {
  activityOverrides?: Record<string, ActivityOverride> // keyed by activity ID
}
```

**Rationale:**

- `exerciseId` is optional -- only present when the user swaps the exercise.
- `setScheme` stores the full `SetScheme` discriminated union (same type used in `Activity`). Storing the complete set scheme rather than partial field diffs avoids complex merge logic across 12+ set scheme variants (fixedSets, percentageSets, workToMax, timedHold, etc.). The user edits a set scheme in the override form; the whole scheme is saved if any field changes.
- Keyed by activity ID (UUID string).
- The outer `SessionOverrides` wrapper allows future extension (e.g., `groupOverrides`, `templateNotes`) without schema migration.

**Example stored value:**

```json
{
  "activityOverrides": {
    "act-uuid-1": {
      "exerciseId": "replacement-exercise-uuid"
    },
    "act-uuid-3": {
      "setScheme": {
        "type": "fixedSets",
        "sets": 4,
        "reps": 6,
        "load": { "value": 185, "unit": "lb", "type": "ABSOLUTE" }
      }
    }
  }
}
```

### Decision 4: Click Routing -- Separate Callbacks vs Unified Handler

**Options considered:**

- **Option A: Two separate callbacks** -- `onPickSession` for empty slots, `onEditSession` for filled slots. Each component decides which to call.
- **Option B: Single `onSlotClick` callback** that receives the session (or null) and the parent routes based on whether a session exists.

**Chosen:** Option A -- Two separate callbacks
**Rationale:** The two actions have completely different state shapes (picker needs weekClientId + dayOfWeek; editor needs the full SessionDraft + weekClientId). Splitting them keeps the type signatures clean and avoids a discriminated-union prop. The `SessionSlot` component already has the `session` prop and can trivially branch.

### Decision 5: Workout-Start Override Merge Point

**Chosen:** Merge overrides inside `startProgrammedWorkout` in `use-active-workout.ts`, after `resolveSessionTemplate()` returns `PrefilledGroup[]` and before persisting to DB.

**Rationale:** This is the single code path where template data becomes workout log entries. A new `applyOverrides(prefilledGroups, overrides)` function walks the resolved groups, matches activities by ID, and swaps `exerciseId` and/or `setScheme` fields. The override is "baked in" to the workout log -- the log stands alone after creation.

**Note:** This requires passing the `SessionOverrides` from the `ScheduledSession` to the workout-start flow. Currently `handleStartProgrammedSession` on the today page only passes `sessionTemplateId` and `programContext`. It will need to also pass `overrides` (nullable).

## Stack-Specific Details

### React/TypeScript (`src/`)

**Files to modify:**

- `src/domain/types/program.ts` -- Add `sessionOverridesSchema`, `SessionOverrides`, `ActivityOverride` types. Add optional `overrides` field to `scheduledSessionSchema`.
- `src/components/program-builder/builder-state.ts` -- Add `notes` and `overrides` fields to `SessionDraft`. Update `assignSession`, `hydrateDraft`, `buildSessionsPayload`, `copyWeek` to handle new fields.
- `src/components/program-builder/session-slot.tsx` -- Branch click handler: empty -> `onPickSession`, filled -> `onEditSession`. Add visual indicator for customized sessions.
- `src/components/program-builder/mobile-block-editor.tsx` -- Same click-routing change for `MobileDayRow`.
- `src/routes/_authenticated/builder.tsx` -- Add edit-sheet state management (selected SessionDraft), wire up `onEditSession` callback, render new `SessionEditSheet`.
- `src/hooks/use-active-workout.ts` -- Accept optional `overrides` param in `startProgrammedWorkout`, call `applyOverrides` after `resolveSessionTemplate`.
- `src/routes/_authenticated/index.tsx` -- Pass `overrides` from today context to `startProgrammedWorkout`.
- `src/lib/tauri-adapter.ts` -- Update `TauriScheduledSessionResponse` and mapper to include `overrides` field.
- `src/lib/data-mapper.ts` -- Update `toScheduledSession` / `fromScheduledSession` to handle `overrides` JSON.

**Files to create:**

- `src/components/program-builder/session-edit-sheet.tsx` -- New edit sheet component with template preview, notes editor, activity override list, change-template and remove-session actions.
- `src/lib/override-merger.ts` -- Pure function `applyOverrides(prefilledGroups, overrides)` that merges overrides into resolved template data.

**Patterns to follow:**

- Sheet/modal pattern: follow `SessionPickerSheet` (uses shadcn Sheet component, responsive).
- State management: follow `.claude/rules/state-management.md` -- pure state functions in `builder-state.ts`, store boundary validation.
- Error handling: follow `.claude/rules/error-handling.md` -- bracketed module prefix logging, guard clauses with user-facing error state.
- TypeScript conventions: follow `.claude/rules/typescript-conventions.md` -- `satisfies Record<K,V>` for exhaustive maps, domain unions as keys.

### Rust/Tauri (`src-tauri/`)

**Files to modify:**

- `src-tauri/migrations/010_session_overrides.sql` -- New migration: `ALTER TABLE scheduled_sessions ADD COLUMN overrides TEXT;` (JSON stored as TEXT in SQLite).
- `src-tauri/src/models.rs` -- Add `pub overrides: Option<String>` to `ScheduledSessionRow`.
- `src-tauri/src/commands/programs.rs` -- Update `CreateScheduledSessionInput` to include `overrides: Option<String>`. Update INSERT queries (both create and update paths) to include the `overrides` column.

**Patterns to follow:**

- Follow `.claude/rules/rust-tauri.md` -- `Result<T, String>` for commands, `?` over `unwrap()`, snake_case naming.
- SQLite stores JSON as TEXT (not a native JSON type). The Rust layer treats it as an opaque string; parsing/validation happens in the TypeScript domain layer.

### Supabase (`supabase/`)

**Files to create:**

- `supabase/migrations/YYYYMMDDHHMMSS_add_session_overrides.sql` -- `ALTER TABLE scheduled_sessions ADD COLUMN overrides JSONB;` with a comment. No RLS changes needed (column inherits existing row-level policies).

**Notes:**

- Supabase uses `JSONB` (native Postgres JSON binary type) while SQLite uses `TEXT`. The TypeScript adapter layer handles serialization/deserialization symmetrically.
- No index needed on the `overrides` column -- it's only read when loading a full program or starting a workout, both of which already filter by `block_week_id`.

## Integration Points

### Builder -> Persistence (Save Flow)

```
SessionDraft.overrides (TS object)
  -> buildSessionsPayload() serializes to JSON string
  -> CreateScheduledSessionInput.overrides (Rust: Option<String>)
  -> INSERT INTO scheduled_sessions ... overrides = ?
```

### Persistence -> Builder (Load Flow)

```
SELECT overrides FROM scheduled_sessions (TEXT/JSONB)
  -> ScheduledSessionRow.overrides (Rust: Option<String>)
  -> TauriScheduledSessionResponse.overrides (JSON string)
  -> toScheduledSession() parses with Zod schema
  -> hydrateDraft() maps to SessionDraft.overrides
```

### Builder -> Workout Start (Override Merge)

```
ScheduledSession.overrides
  -> passed to startProgrammedWorkout()
  -> resolveSessionTemplate() returns PrefilledGroup[]
  -> applyOverrides(prefilledGroups, overrides) mutates in place
  -> persisted as LoggedActivity + LoggedSet entries
```

## Risks & Unknowns

- **Risk:** Template activities deleted after overrides are set.
  - **Mitigation:** `applyOverrides` silently skips override keys that don't match any resolved activity. Orphaned overrides are harmless dead data. Optionally, the edit sheet could detect and surface stale overrides on load.

- **Risk:** Set scheme complexity -- 12 variants with different field shapes.
  - **Mitigation:** Store full `SetScheme` in override (not partial fields). The existing `SetSchemeEditor` component and `setSchemeSchema` Zod validation handle all variants already. The edit sheet reuses these.

- **Risk:** `copyWeek` propagates overrides when copying sessions between weeks.
  - **Mitigation:** Intentional -- when copying a week, overrides travel with the session. This matches user expectation ("copy this customized week"). The user can reset individual overrides in the edit sheet.

- **Unknown:** Share link flow (`shared-program-view.tsx`) uses RPC types that don't include overrides.
  - **Resolution plan:** Out of scope for this feature. Shared programs show base template data. Overrides are personal customizations and don't need to transfer via share links. Can be added later if needed.

## Testing Strategy

- **Unit tests (`builder-state.test.ts`):** Test that `assignSession` preserves existing overrides when re-assigning the same template, `hydrateDraft` correctly maps overrides, `buildSessionsPayload` serializes overrides, and `copyWeek` propagates overrides.
- **Unit tests (`override-merger.test.ts`):** Test `applyOverrides` -- exercise swap, set scheme swap, combined overrides, orphaned keys (silently skipped), null/empty overrides (no-op).
- **Component tests:** `SessionSlot` click routing (empty vs filled), `SessionEditSheet` renders template data and persists overrides to draft.
- **Integration/manual:** Full save-reload cycle with overrides, workout start with overrides applied, visual indicator on customized slots.
- **Rust:** No new Rust unit tests needed -- the column is an opaque TEXT field. Existing `programs.rs` integration paths cover the INSERT/SELECT.
