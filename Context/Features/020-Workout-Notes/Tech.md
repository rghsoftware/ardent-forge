# Tech Plan: Workout Notes

**Spec:** Context/Features/020-Workout-Notes/Spec.md
**Stacks involved:** React/TypeScript (frontend), Rust/Tauri (offline adapter), Supabase (Postgres + RLS)

## Architecture Overview

Workout notes are stored as text + tags at three existing rows in the
`workout_logs` / `logged_activities` / `logged_sets` hierarchy. The text
columns (`overall_notes`, `notes`, `notes`) already exist and are already
written by the manual entry form (`src/components/workout/manual-workout-form.tsx`).
What is missing:

1. **Tag storage** — no column today; this feature adds a `note_tags TEXT[]`
   column to all three tables (one migration).
2. **Active-workout integration** — `src/stores/active-workout-store.ts` has
   no notes fields and no actions for updating them. The store gains
   `setSessionNote`, `setActivityNote`, `setSetNote` actions and the
   corresponding values flow through the existing log-flush path on workout
   finish (and on the periodic active-workout sync).
3. **Mid-workout note UI** — a new `<NoteSheet>` bottom sheet (matches the
   F018 active workout idiom from `circuit-panel.tsx` / `rest-panel.tsx`)
   and small note affordance components (`<NoteAffordance>` for set rows
   and exercise cards, `<NoteIndicator>` dot for "has note" hints).
4. **History rendering** — extend `workout-detail-header.tsx` and
   `workout-detail-exercises.tsx` to render notes + tag chips inline at the
   level they were captured.
5. **History search** — the history list route gets a search input that
   filters client-side first (substring on already-fetched session notes /
   exercise notes / set notes). Server-side ILIKE filter added to
   `useWorkoutLogs` for the list query when the search string is non-empty.
6. **Shared note primitives** — extracted from `manual-workout-form.tsx`
   into `src/components/workout/notes/` so both the manual form and the
   active workout flow consume identical components and validation.

The existing `manual-workout-form.tsx` is the reference implementation for
note text persistence. This feature does NOT replace its behavior; it
extracts shared primitives, adds tag support, and brings the same capability
into the active workout flow + history view.

## Key Decisions

### Decision 1: Tag storage shape

**Options considered:**

- **Option A — `note_tags TEXT[]` column on each of the 3 tables.**
  Native Postgres array type, indexable with GIN, RLS already covered by
  the parent row's policies. Search remains a single-table query. Adds 3
  nullable columns via one migration.
  - Trade-offs: Requires touching the data-mapper / data-adapter for 3
    tables. Migration must coordinate with the offline SQLite schema in
    `src-tauri/`.
- **Option B — Inline-encode tags in the existing `notes TEXT` field**
  (e.g. leading `[FORM BREAKDOWN][GRINDY] knees caving`).
  - Trade-offs: Zero migration. But search becomes brittle, the manual
    form has to parse on load and serialize on save, and the chip set
    becomes coupled to a stringly-typed convention. Re-rendering chips
    requires regex on every read.
- **Option C — Sibling `note_tags` table** keyed on
  `(parent_table, parent_id, tag)`.
  - Trade-offs: Most flexible, allows tag analytics queries. Heaviest
    write path: every note save becomes a multi-row diff. Overkill for
    a curated 10-tag list.

**Chosen:** **Option A** — `note_tags TEXT[]` column on
`workout_logs`, `logged_activities`, `logged_sets`.

**Rationale:** Postgres-native arrays are well-supported, indexable, and
match how the curated tag list is consumed (read all tags for a row in
one shot). Migration is small and atomic. Search via `note_tags && $1`
or `notes ILIKE $1` stays in a single query per table. Avoids the
parsing fragility of Option B and the write amplification of Option C.

**Related ADRs:** None directly. Aligns with the project convention of
JSONB/array columns on parent rows over normalized child tables for
small bounded sets (cf. `bodyweight_at_session JSONB`,
`program_context JSONB`).

### Decision 2: Tag taxonomy (starter set + user-defined)

**Options considered:**

- **Curated Zod enum only** — locked list, code change to extend.
- **Free-form strings only** — no starter set.
- **Starter set in code + free-form user-created tags.**

**Chosen:** **Starter set + user-defined.** A starter list ships in
`src/domain/types/workout-note.ts` as a plain `string[]` constant
(NOT a Zod enum), and the tag picker allows free entry of new tags.
The Zod schema enforces shape only: `z.string().min(1).max(32)` per
tag, with a uniform format normalization (uppercase + collapse
internal whitespace) applied at the store boundary.

Starter list (seeds the picker):

```
FORM BREAKDOWN, FELT HEAVY, FELT LIGHT, PR ATTEMPT, SCALED,
SUBSTITUTION, PAUSED, GRINDY, FAST, LOW ENERGY
```

**Rationale:** Athletes know their own jargon (e.g. "BAR PATH",
"LOWER BACK PUMP", "BELT ON") and a locked enum would force them
back to free-text for anything outside the curated set. The starter
list still exists to seed the picker so a brand-new user has
something to tap immediately. User-created tags merge into the
recently-used Zustand slice and surface alongside the starter set,
ranked by recent use.

Storage CHECK constraint is dropped: enforcing length and shape
(`char_length <= 32`, `array_length <= 16`) is sufficient. No
fixed-list constraint.

**Related ADRs:** ADR-008 (dual-export Zod schemas) — the shape
schema is dual-exported so the Tauri adapter validates the same
length/format rules as the frontend.

### Decision 3: Mid-workout entry surface

**Options considered:**

- **Option A — Bottom sheet (`<NoteSheet>`)** matching F018 active workout
  panels (`rest-panel.tsx`, `circuit-panel.tsx`).
- **Option B — Inline expansion** under the set row.
- **Option C — Modal dialog.**

**Chosen:** **Bottom sheet.**

**Rationale:** Matches the established F018 active-workout pattern and
preserves the full-screen workout shell. Spec assertion 1 (≤2 taps) and
assertion 7 (rest timer uninterrupted) are both naturally satisfied:
the sheet overlays without unmounting the workout shell. Inline
expansion (Option B) competes with the dense set row layout and breaks
on small screens; modal dialog (Option C) feels heavier than the sheet
idiom and conflicts with the brutalist no-shadow rule.

**Related ADRs:** None. Reinforces F018/F019 layout decisions.

### Decision 4: Autosave semantics

**Options considered:**

- **Autosave on blur AND on sheet dismiss**, no save button.
- **Explicit save button.**
- **Debounced autosave on every keystroke.**

**Chosen:** **Autosave on blur and on sheet dismiss.** No save button.

**Rationale:** Matches Spec requirement "must autosave on blur or sheet
dismiss" and the gym-floor usability principle (minimum taps).
Keystroke-debounced autosave is overkill given write-through to Zustand
is already synchronous; the sync queue only flushes on workout
completion and the periodic background sync. Explicit save buttons add
a tap and fail the ≤2-tap assertion when combined with the open gesture.

**Related ADRs:** None.

### Decision 5: Active-workout store integration

**Options considered:**

- **Option A — Add note fields directly to the store's session, activity,
  and set state**, with three setter actions. Notes flush with the rest
  of the workout at finish/sync via the existing path.
- **Option B — Side-channel store** (`active-workout-notes-store.ts`)
  that flushes independently.

**Chosen:** **Option A.**

**Rationale:** Notes are part of the workout payload at every layer in
the schema. A side-channel store would need its own offline queue, sync
reconciliation, and crash recovery — duplicate concerns the active
workout store already handles. State colocation also makes
optimistic UI trivial: the set row reads `set.notes` from the same
selector as `set.actualReps`.

**Related ADRs:** None. Aligns with the existing single-source-of-truth
pattern in `active-workout-store.ts`.

### Decision 6: History search implementation

**Options considered:**

- **Option A — Client-side substring filter** on the already-fetched
  history list (sessions + their nested activities/sets).
- **Option B — Server-side `ILIKE` filter** added to the `useWorkoutLogs`
  list query.
- **Option C — Postgres full-text (`tsvector` + `pg_trgm`)** with a
  generated column on `overall_notes` and a search RPC.

**Chosen:** **Option A for v1 (client-side)**, with Option B as a
follow-up if list size makes client filter sluggish. Option C deferred.

**Rationale:** v1 history list is already paginated and small per page.
Substring on the loaded page is instant and requires zero schema /
query changes. The Spec's "Won't (v1)" already calls out that
full-text infrastructure is out of scope. Defer Option B until a
real performance complaint exists. If we ship Option A and find list
pages don't include nested activity/set notes (likely — the list query
probably only fetches session-level fields), then we add an `ILIKE`
parameter to the list query to match on `overall_notes` server-side and
keep nested-note search to the detail view. Phase 3 must verify the
list query payload to confirm the right approach.

**Related ADRs:** None.

### Decision 7: Shared component location

**Options considered:**

- `src/components/workout/notes/` — colocated with other workout components.
- `src/components/notes/` — top-level domain folder.

**Chosen:** `src/components/workout/notes/`.

**Rationale:** Notes are workout-scoped, never reused outside the workout
domain. Colocation matches existing structure (`src/components/workout/`
already houses `set-row.tsx`, `exercise-block.tsx`, etc.). The manual
workout form, the active workout flow, and the history detail view are
all workout-scoped consumers.

## Stack-Specific Details

### Supabase (Postgres)

- **Files to create:**
  - `supabase/migrations/YYYYMMDDHHMMSS_add_note_tags.sql` — adds
    `note_tags TEXT[] NOT NULL DEFAULT '{}'` to `workout_logs`,
    `logged_activities`, `logged_sets`. Adds CHECK constraints for
    shape only: `array_length(note_tags, 1) IS NULL OR array_length(note_tags, 1) <= 16`
    and a per-element length check via a trigger or `WHERE NOT EXISTS`
    pattern (or simply rely on application-level Zod for length and
    only constrain array length at the DB). Adds GIN indices
    `idx_workout_logs_note_tags`, `idx_logged_activities_note_tags`,
    `idx_logged_sets_note_tags` for future tag-filtered queries.
- **Patterns to follow:** `.claude/rules/supabase.md` —
  lowercase SQL keywords, snake_case columns, atomic migration,
  RLS inherited from parent rows (no new policies needed since the
  array column lives on rows already covered by existing policies).
- **Dependencies:** None new.

### Rust/Tauri (offline adapter)

- **Files to modify:**
  - `src-tauri/migrations/` — mirror migration adding `note_tags TEXT`
    (SQLite has no native array; store as JSON-encoded array string,
    consistent with how the adapter encodes other JSONB columns).
  - `src-tauri/src/` data adapter modules that handle
    `workout_logs` / `logged_activities` / `logged_sets` reads + writes
    must serialize/deserialize the `note_tags` column.
- **Patterns to follow:** ADR-011 (rust dynamic SQL bind pairing) for
  any new bind list. Existing JSONB-as-TEXT columns
  (`bodyweight_at_session`, `program_context`) are the precedent.
- **Dependencies:** None new.

### React/TypeScript (frontend)

- **Files to create:**
  - `src/domain/types/workout-note.ts` — `noteTagSchema` Zod enum,
    `noteContentSchema` (text + tags), dual-exported per ADR-008.
  - `src/components/workout/notes/note-sheet.tsx` — bottom sheet for
    free-text + tag picker. Used by both active workout and manual form.
  - `src/components/workout/notes/note-tag-picker.tsx` — chip grid
    component. Tracks "recently used" via a small Zustand slice.
  - `src/components/workout/notes/note-affordance.tsx` — tappable
    "Add note / Edit note" trigger that opens the sheet.
  - `src/components/workout/notes/note-indicator.tsx` — small dot/badge
    rendered on set rows and exercise cards when a note is present.
  - `src/components/workout/notes/note-display.tsx` — read-only render
    of a note (text + tag chips) for the history view.
  - `src/stores/recent-tags-store.ts` — local-only Zustand store with
    `persist` middleware for "recently used" chip ordering.
- **Files to modify:**
  - `src/stores/active-workout-store.ts` —
    add `noteTags` to session/activity/set state, add
    `setSessionNote(text, tags)`, `setActivityNote(activityId, ...)`,
    `setSetNote(setId, ...)` actions. Honor state-management rules
    (validate tag enum at the store boundary per
    `.claude/rules/state-management.md`).
  - `src/components/workout/set-row.tsx` — render `<NoteAffordance>` and
    `<NoteIndicator>` per Spec assertions 1, 8.
  - `src/components/workout/exercise-block.tsx` — render exercise-level
    note affordance + indicator.
  - `src/components/workout/workout-header.tsx` — render session-level
    note affordance + display in the active-workout shell.
  - `src/components/workout/manual-workout-form.tsx` — replace existing
    inline `<textarea>` notes with `<NoteSheet>`-driven inputs at the
    same three levels. Maintains React Hook Form integration.
  - `src/components/history/workout-detail-header.tsx` — render
    `<NoteDisplay>` for `overall_notes`.
  - `src/components/history/workout-detail-exercises.tsx` — render
    `<NoteDisplay>` for each activity and set.
  - `src/components/history/workout-history-card.tsx` — render
    `<NoteIndicator>` when any note is present on the session.
  - `src/routes/_authenticated/history/index.tsx` — add a search input
    that filters the loaded list client-side (Decision 6).
  - `src/hooks/use-workout-logs.ts` — accept `noteTags` in upsert
    payloads. Optionally extend list query with a search param if
    Phase 3 finds the list payload doesn't include nested notes
    (deferred — measure first).
- **Patterns to follow:**
  - `.claude/rules/typescript-conventions.md` — `satisfies Record<NoteTag, ...>`
    for any tag style/icon map.
  - `.claude/rules/state-management.md` — Zustand store boundary
    validation on the new note actions.
  - `.claude/rules/error-handling.md` — `useQuery` callers must handle
    `isError`; any new mutation has a `[notes]` log prefix on failure.
  - `.claude/rules/layout-conventions.md` — history search input
    respects `mx-auto max-w-5xl` and progressive padding.
  - Iron & Ember design system (DESIGN.md) — chips ALL-CAPS, no border
    radius, tonal layering for "active tag" state, ember accent only
    on the primary save / confirm path.
- **Dependencies:** None new. Reuses Zustand, React Hook Form, Zod,
  Tailwind, and existing shadcn primitives.

## Integration Points

### Active workout → adapter sync

The active workout store currently flushes pending writes to the
adapter on workout finish (`completeWorkout` / equivalent action) and
on the periodic background sync. Notes piggyback on the existing
flush path — the upsert payload simply gains `notes` and `noteTags`
fields at all three levels. No new IPC channel.

### Manual form → adapter

`manual-workout-form.tsx` uses React Hook Form with the existing
`workoutLogSchema`. Adding `noteTags` requires extending the form's
local Zod schema and the adapter mutation payload. No new mutation;
the existing `upsertWorkoutLogFull` (or whatever path the manual form
already uses) gains the new fields.

### History list query

Today the list query likely returns session-level fields only. For
client-side substring search to cover exercise/set notes, the list
query must either include nested notes (heavier payload) or the
search must be limited to session-level matches with detail-view
matches deferred. **Phase 3 must verify the list query payload before
deciding.** Recommended: if nested notes are not in the list payload,
keep client-side search session-level only and document the limitation.

### Shared note primitives → manual form refactor

The shared `<NoteSheet>` and friends replace the inline `<textarea>`
fields in `manual-workout-form.tsx`. This is a behavior-preserving
refactor: same fields, same persistence, same validation. The form's
React Hook Form bindings change from `register('notes')` to
controlled-component bindings driven by the sheet's `onChange`.

## Risks & Unknowns

- **Risk: Migration must land in both Supabase and the SQLite offline
  adapter atomically.** A frontend that writes `noteTags` against an
  un-migrated SQLite schema will throw at the adapter boundary.
  - **Mitigation:** Order Steps.md so the SQLite migration ships in
    the same release as the Supabase migration, and the frontend code
    is gated on both. Build-then-validate the migration before any
    UI work begins.

- **Risk: List query payload for history search.** If the list query
  doesn't return nested activity/set notes, client-side search misses
  matches that exist on detail view.
  - **Mitigation:** Phase 3 task 1 inspects `useWorkoutLogs` list
    query shape. If nested notes are absent, scope v1 search to
    session-level notes only and document the limitation in Spec
    "Won't (v1)". Server-side `ILIKE` is the follow-up if real users
    complain.

- **Risk: `manual-workout-form.tsx` is 972 lines and already supports
  notes via inline textareas.** The refactor to use shared primitives
  is invasive and easy to regress.
  - **Mitigation:** Validate the manual form's create + edit paths
    after the refactor with the existing
    `__tests__/manual-workout-form.test.tsx` (extend with tag
    coverage). Use the build-then-validate pattern: a frontend
    specialist refactors, quality-engineer validates against the
    Spec assertions.

- **Risk: Free-form tag pollution.** User-created tags can drift
  (e.g. `BARPATH`, `BAR PATH`, `BAR  PATH`).
  - **Mitigation:** Normalize at the store boundary — uppercase,
    trim, collapse internal whitespace to a single space — before
    persisting. Recently-used picker dedupes case-insensitively.
    Length capped at 32 chars by Zod.

- **Unknown: Does the existing list query already include nested
  notes?**
  - **Resolution plan:** Phase 3 task 1 inspects
    `src/hooks/use-workout-logs.ts` and the data adapter list query.
    Branch on the answer.

- **Unknown: Is there an existing `recently-used` persistence
  pattern in the codebase?**
  - **Resolution plan:** Check `src/stores/` and Zustand persist
    usage during Phase 3. If a generic pattern exists, reuse it;
    otherwise add a small dedicated store with `persist`.

- **Risk: Active workout store lines 22-150 define types and a single
  source of truth for in-progress state.** Adding note fields here
  requires touching `LoggedActivityWithSets` /
  `LoggedActivityGroupWithActivities` shapes, which may ripple into
  selectors and crash-recovery serialization
  (`crash-recovery-dialog.tsx`).
  - **Mitigation:** Make `notes` and `noteTags` optional on the
    in-memory shapes (default to `''` and `[]`) so existing
    selectors don't break. Crash-recovery snapshots get the new
    fields automatically as part of the JSON serialization.

## Testing Strategy

- **Unit (Vitest, frontend):**
  - `noteTagSchema` validates known + rejects unknown tags.
  - `<NoteSheet>` autosaves on blur and on dismiss; never on keystroke.
  - `<NoteTagPicker>` reorders chips by recently-used.
  - `active-workout-store` setter actions update the right level and
    validate tags at the boundary.
  - `manual-workout-form` create + edit paths still pass after the
    shared-primitive refactor; new tests cover tag persistence at
    all three levels.
  - History search filter logic — given a list of sessions with
    notes, returns the matching subset.

- **Integration (Vitest + Tauri mocks):**
  - Round-trip: write a session with notes and tags via the active
    workout store → flush → read back via the history detail query.
  - SQLite migration: schema after migration matches the Supabase
    column shape; tag CHECK constraint enforced.

- **Manual / gym-floor:**
  - Mid-workout: open sheet on a set row in ≤2 taps; rest timer keeps
    running and remains visible (Spec assertions 1, 7).
  - Color-blind check on chip rendering at all three levels
    (Spec assertion 8).
  - Touch targets ≥48px on the affordance and chip grid.
  - History search across sessions containing "shoulder" returns the
    expected matches (Spec assertion 6).

- **Build-then-validate:** All changes to
  `active-workout-store.ts`, the new migration, and the refactor of
  `manual-workout-form.tsx` go through a frontend-specialist /
  quality-engineer pair per CLAUDE.md.
