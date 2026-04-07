# Implementation Steps: Workout Notes

**Spec:** Context/Features/020-Workout-Notes/Spec.md
**Tech:** Context/Features/020-Workout-Notes/Tech.md
**Stacks:** React/TypeScript, Rust/Tauri, Supabase

## Team Composition

| Role                | Responsibility                                             |
| ------------------- | ---------------------------------------------------------- |
| backend-engineer    | Supabase migration, RLS verification                       |
| tauri-specialist    | SQLite mirror migration, adapter read/write of `note_tags` |
| frontend-specialist | Domain types, store integration, all UI components, routes |
| quality-engineer    | Validation against Spec assertions, build-then-validate    |

The manual workout form is **not refactored** in this feature (per user
direction). Manual entry retains its existing inline textareas. New note
primitives are built fresh and consumed only by the active workout flow
and the history view.

---

## Wave 0 — Discovery (sequential, blocks everything)

### S001 — Inspect history list query payload

**Owner:** frontend-specialist
**Files:** `src/hooks/use-workout-logs.ts`, `src-tauri/src/` adapter list paths
**Outcome:** Confirm whether the history list query already returns nested
activity/set notes. Document finding inline in this Steps.md as a note on
S014. If nested notes are absent, scope v1 history search to session-level
notes only.
**Blocks:** S014

### S002 — Inspect active-workout-store shape and crash recovery

**Owner:** frontend-specialist
**Files:** `src/stores/active-workout-store.ts`, `src/components/workout/crash-recovery-dialog.tsx`
**Outcome:** Document exactly which type shapes
(`LoggedActivityWithSets`, `LoggedActivityGroupWithActivities`) need new
optional fields, and confirm crash-recovery snapshot serialization picks
them up automatically.
**Blocks:** S008

---

## Wave 1 — Data layer (parallel within wave)

### S003 — Supabase migration: `note_tags` columns + GIN indices

**Owner:** backend-engineer
**Files:** `supabase/migrations/YYYYMMDDHHMMSS_add_note_tags.sql`
**Outcome:**

- `ALTER TABLE workout_logs ADD COLUMN note_tags TEXT[] NOT NULL DEFAULT '{}'`
- Same on `logged_activities`, `logged_sets`
- CHECK: `array_length(note_tags, 1) IS NULL OR array_length(note_tags, 1) <= 16`
- GIN indices `idx_workout_logs_note_tags`, `idx_logged_activities_note_tags`, `idx_logged_sets_note_tags`
- Migration comment documents the column purpose and the 32-char per-element rule enforced at the application layer
- RLS: no new policies (inherited)
- Verify locally with `npx supabase db push`
  **Depends on:** none
  **Parallel with:** S004, S005

### S004 — Tauri SQLite mirror migration

**Owner:** tauri-specialist
**Files:** `src-tauri/migrations/` (next sequential file)
**Outcome:** Add `note_tags TEXT NOT NULL DEFAULT '[]'` to the SQLite
mirror tables for `workout_logs`, `logged_activities`, `logged_sets`.
Stored as a JSON-encoded array string per the precedent of
`bodyweight_at_session` / `program_context`.
**Depends on:** none
**Parallel with:** S003, S005

### S005 — Domain types: `noteTagSchema`, `noteContentSchema`, normalization

**Owner:** frontend-specialist
**Files:** `src/domain/types/workout-note.ts`, `src/domain/types/index.ts`
**Outcome:**

- `STARTER_NOTE_TAGS: readonly string[]` constant (10 starter chips)
- `noteTagSchema = z.string().min(1).max(32).transform(normalizeTag)`
- `normalizeTag(input)` — uppercase, trim, collapse internal whitespace
- `noteContentSchema = z.object({ text: z.string().default(''), tags: z.array(noteTagSchema).max(16).default([]) })`
- Dual-export per ADR-008
- Re-export from `src/domain/types/index.ts` barrel
  **Depends on:** none
  **Parallel with:** S003, S004

### S006 — Adapter: read/write `note_tags` at all 3 levels

**Owner:** tauri-specialist
**Files:** `src-tauri/src/` data adapter modules for workout_logs, logged_activities, logged_sets; corresponding TS adapter wrappers
**Outcome:** SELECT statements include `note_tags`; INSERT/UPDATE bind
the new column. JSON encode/decode at the SQLite boundary. Apply
ADR-011 dynamic SQL bind pairing rules.
**Depends on:** S004, S005
**Parallel with:** S007

### S007 — `useWorkoutLogs` payload extension

**Owner:** frontend-specialist
**Files:** `src/hooks/use-workout-logs.ts`
**Outcome:** Upsert mutation accepts `noteTags` at session, activity,
set levels alongside the existing `notes` text. No list-query change in
this step (Wave 4 handles search). Apply error-handling rules
(`[notes]` log prefix on failure).
**Depends on:** S005
**Parallel with:** S006

### S001-T — Test: domain schema + normalization

**Owner:** frontend-specialist
**Files:** `src/domain/types/__tests__/workout-note.test.ts`
**Outcome:** Round-trips known input, normalizes whitespace + casing,
rejects empty / over-length tags, accepts free-form user tags, dedupes
in arrays.
**Depends on:** S005

---

## **Milestone M1 — Data layer ready**

**Contract:** Both Supabase and SQLite have `note_tags` columns;
`useWorkoutLogs` accepts the new payload; `noteContentSchema` validates
end-to-end. Quality-engineer confirms a manual round-trip via the
adapter unit tests before Wave 2 starts.

**Validates assertions:** none directly; foundation only.

**Quality gate:** S008 is BLOCKED until M1 passes.

---

## Wave 2 — Active workout integration (sequential within wave)

### S008 — Active workout store: note state + actions

**Owner:** frontend-specialist
**Files:** `src/stores/active-workout-store.ts`
**Outcome:**

- Add optional `notes: string` and `noteTags: string[]` to session-level
  state, `LoggedActivityWithSets`, and `LoggedSet` shapes (default `''` / `[]`)
- Actions: `setSessionNote(content)`, `setActivityNote(activityId, content)`,
  `setSetNote(setId, content)` where `content: { text, tags }`
- Validate `noteContentSchema` at the store boundary per
  `.claude/rules/state-management.md`
- Notes flush via the existing finish/sync path — extend the payload
  builder to include the new fields
- Crash recovery serialization auto-includes new fields (verify per S002)
  **Depends on:** M1, S002
  **Blocks:** S009-S012

### S008-T — Test: active workout store note actions

**Owner:** frontend-specialist
**Files:** `src/stores/__tests__/active-workout-store.test.ts`
**Outcome:** Setter actions update the right level, validate tags,
normalize on write, and survive a crash-recovery snapshot round-trip.
**Depends on:** S008

---

## Wave 3 — UI components + active-workout integration (parallel where noted)

### S009 — `recent-tags-store` (local Zustand persist)

**Owner:** frontend-specialist
**Files:** `src/stores/recent-tags-store.ts`
**Outcome:** Tiny Zustand store with `persist` middleware. State:
`recent: string[]` (capped at 20). Action: `markUsed(tag)` moves to
front, dedupes case-insensitively. No sync to Supabase.
**Depends on:** S005
**Parallel with:** S010

### S010 — `<NoteTagPicker>` chip grid component

**Owner:** frontend-specialist
**Files:** `src/components/workout/notes/note-tag-picker.tsx`
**Outcome:**

- Renders chips combining starter tags + recent tags, ranked recent-first
- Inline "+ NEW TAG" affordance opens a small input that creates a new
  tag on submit, normalizes, persists to recent-tags-store, and selects it
- Active state via tonal layering (no border, no shadow per Iron & Ember)
- ALL-CAPS chip labels, ≥48px touch targets
- Color-blind safe: chip text + selected-state background tone shift
  **Depends on:** S005, S009
  **Parallel with:** S009 (after S009 lands)

### S011 — `<NoteSheet>` bottom sheet

**Owner:** frontend-specialist
**Files:** `src/components/workout/notes/note-sheet.tsx`
**Outcome:**

- Bottom sheet matching F018 panel idiom (`rest-panel.tsx` style)
- Multiline `<textarea>` + embedded `<NoteTagPicker>`
- Autosaves on blur AND on dismiss; no save button
- Props: `{ value: NoteContent, onChange: (next) => void, level: 'session' | 'exercise' | 'set', onDismiss?: () => void }`
- Honors `prefers-reduced-motion` for entry animation
- Never blocks the rest timer (overlay only — does NOT unmount the workout shell)
  **Depends on:** S010

### S012 — `<NoteAffordance>`, `<NoteIndicator>`, `<NoteDisplay>`

**Owner:** frontend-specialist
**Files:**

- `src/components/workout/notes/note-affordance.tsx`
- `src/components/workout/notes/note-indicator.tsx`
- `src/components/workout/notes/note-display.tsx`
  **Outcome:**
- `<NoteAffordance>` — tappable trigger ("ADD NOTE" / "EDIT NOTE"), opens `<NoteSheet>`
- `<NoteIndicator>` — small dot/badge for "has note" hint on dense rows
- `<NoteDisplay>` — read-only renderer (text + tag chips) for history view
- All ≥48px hit areas where interactive
  **Depends on:** S011

### S013 — Wire affordances into active-workout UI

**Owner:** frontend-specialist
**Files:**

- `src/components/workout/set-row.tsx`
- `src/components/workout/exercise-block.tsx`
- `src/components/workout/workout-header.tsx`
  **Outcome:**
- Set rows render `<NoteAffordance>` + `<NoteIndicator>`; tap opens sheet bound to `setSetNote`
- Exercise blocks render `<NoteAffordance>` + `<NoteIndicator>`; tap opens sheet bound to `setActivityNote`
- Workout header renders `<NoteAffordance>` for session-level note bound to `setSessionNote`
- All affordances respect Spec assertion 1 (≤2 taps from set row state to open the sheet)
  **Depends on:** S008, S012

### S013-T — Test: active workout UI integration

**Owner:** frontend-specialist
**Files:** `src/components/workout/notes/__tests__/note-sheet.test.tsx`, plus extensions to existing set-row tests
**Outcome:**

- `<NoteSheet>` autosaves on blur and dismiss, never on keystroke
- `<NoteTagPicker>` reorders chips by recently-used, allows new tag creation
- Set row open-sheet flow is ≤2 taps (Spec assertion 1)
- Rest timer continues during sheet open (Spec assertion 7) — verify via store-state assertion
  **Depends on:** S013

---

## **Milestone M2 — Active workout note capture functional**

**Contract:** A user can open the active workout, add notes + tags at
session/exercise/set levels, finish the workout, and the data persists
through the existing flush path. Quality-engineer validates Spec
assertions 1, 2, 3, 5, 7, 8 against the running app.

**Validates assertions:** 1, 2, 3, 5, 7, 8.

---

## Wave 4 — History rendering + search (parallel within wave)

### S014 — Render notes in history detail

**Owner:** frontend-specialist
**Files:**

- `src/components/history/workout-detail-header.tsx`
- `src/components/history/workout-detail-exercises.tsx`
- `src/components/history/workout-history-card.tsx`
  **Outcome:**
- Detail header renders `<NoteDisplay>` for the session's `overall_notes` + `noteTags`
- Detail exercises render `<NoteDisplay>` for each activity and each set when present
- History card renders `<NoteIndicator>` when any note is present at any level
- No empty placeholders when notes are absent (Spec assertion 9)
  **Depends on:** S012, M2
  **Parallel with:** S015

### S015 — History list search input

**Owner:** frontend-specialist
**Files:** `src/routes/_authenticated/history/index.tsx`
**Outcome:**

- Add search input above the list (respects `mx-auto max-w-5xl` and progressive padding per layout rules)
- Client-side substring filter on the loaded sessions
- Scope per S001 finding: if the list query lacks nested notes, filter on session-level `overall_notes` + `noteTags` only and add a one-line note in the empty-state copy ("Search matches workout-level notes")
- Case-insensitive substring; trims whitespace
- Empty state when no matches
  **Depends on:** M2, S001
  **Parallel with:** S014

### S015-T — Test: history search filter

**Owner:** frontend-specialist
**Files:** `src/routes/_authenticated/history/__tests__/history-search.test.tsx` (or colocated test)
**Outcome:** Given a list of sessions with mixed notes/tags, search
returns the matching subset, excludes non-matches, and matches
case-insensitively. Validates Spec assertion 6 at the scope determined
by S001.
**Depends on:** S015

---

## **Milestone M3 — Notes visible and searchable in history**

**Contract:** Notes captured at any level are visible in history detail;
notes captured at session level (or all levels per S001 finding) are
searchable from the history list.

**Validates assertions:** 4, 6, 9.

---

## Wave 5 — Validation + polish

### S016 — Quality-engineer end-to-end validation

**Owner:** quality-engineer
**Files:** none (validation only)
**Outcome:** Walks every Spec testable assertion against the running
app. Reports pass/fail per assertion. Specifically verifies:

- ≤2-tap open from set row (assertion 1)
- Autosave on blur + dismiss (assertion 2)
- Pre-session note visible in active header (assertion 3)
- Notes render at every level in detail view (assertion 4)
- Sync failure preserves local note (assertion 5)
- Search returns expected matches (assertion 6, scoped per S001)
- Rest timer uninterrupted during sheet open (assertion 7)
- Color-blind safe chip rendering (assertion 8)
- No empty placeholders for absent notes (assertion 9)
  **Depends on:** M3
  **Blocks:** S017

### S017 — Address validation findings

**Owner:** frontend-specialist
**Files:** TBD per S016 findings
**Outcome:** Resolve any failing assertions from S016. Re-validate.
**Depends on:** S016

### S018-D — Documentation: feature notes in CHANGELOG / Context

**Owner:** frontend-specialist
**Files:** `Context/Features/020-Workout-Notes/Spec.md` (mark closed),
project CHANGELOG if present
**Outcome:** Mark feature as shipped, archive plan if appropriate.
**Depends on:** S017

---

## Execution notes

- **Recommended command:** `/team-impl 020` — this feature spans 3
  stacks (Supabase, Tauri, frontend) with a tight contract at M1 and
  cross-domain coordination through the migration → adapter →
  store → UI chain. Peer-to-peer Agent Teams collaboration fits better
  than isolated sub-agent execution.
- All code touches the active workout store, the offline adapter, and
  Supabase migrations — high-stakes. Use build-then-validate pattern at
  every milestone (frontend-specialist builds, quality-engineer validates).
- Migrations (S003, S004) MUST land in the same release; do not merge
  one without the other.
- Manual workout form (`manual-workout-form.tsx`) is **out of scope**
  for code changes. Existing inline textarea behavior is preserved.
