# Feature 020: Workout Notes

## Overview

A first-class notes system for in-progress and completed workouts. Users can
capture context at three levels — whole session, individual exercise, and
individual set — using either free-form text or quick-tag chips. Notes sync to
Supabase, surface in workout history, and are searchable from the history view.

## Problem Statement

Athletes routinely need to capture context that doesn't fit the structured
log: form cues ("knees caving on rep 8"), environmental factors ("equipment
sub: trap bar"), how a set felt ("paused, grindy"), or session-level outcomes
("low sleep, dropped intensity"). Today the schema has `notes` columns at the
session, exercise, and set level, but the UI exposes none of them in the
active-workout flow and offers no consistent surface for entering or reviewing
them. As a result athletes either:

- Lose context they intended to capture, or
- Resort to a separate notes app that isn't tied back to the set/exercise

This kills one of the highest-value uses of a training log: spotting patterns
across sessions ("RPE 9 every time I bench after running" → reorder concurrent
training).

## User Stories

1. **Mid-set form cue** — As a lifter mid-workout, I tap a set, jot "stay
   tight off the bottom", and continue without losing my place in the log.
2. **Quick-tag a set** — As a CrossFitter chasing throughput, I tap a chip
   (e.g. "FORM BREAKDOWN", "SCALED", "FELT HEAVY") on a set in <1 second
   without typing.
3. **Exercise-level context** — As a programmer, I add "switched to safety
   bar — left shoulder" once at the exercise level rather than repeating it on
   every set.
4. **Session debrief** — As an athlete reviewing after a workout, I add an
   overall note ("first session back after travel, took 2 warmup sets extra").
5. **Pre-session intent** — As a planner, before pressing start I leave a
   note on the upcoming session ("focus: bar path on the press").
6. **History review** — As an athlete reviewing last month's training, I see
   notes inline on the history detail view at the level they were captured
   (session header, exercise card, set row).
7. **Search** — As an athlete spotting a recurring issue, I search history for
   "shoulder" and find every session, exercise, or set whose note mentions it.

## Requirements

### Must

- Notes can be created/edited/deleted at three levels: session, exercise
  (logged_activity), and set (logged_set), reusing existing schema columns.
- Notes are editable in three contexts: pre-session (planning), during the
  active workout (mid-session), and post-session (history detail view and
  manual edit form from F020-adjacent feature).
- A quick-tag system: a starter set of preset chips ships in code, AND users
  can create their own custom tags ad-hoc from the tag picker. Tags persist
  as part of the note payload, color-blind safe, glove-friendly.
- Free-text notes support multiline entry; no markdown rendering for v1.
- Mid-workout entry must require ≤2 taps to open the editor for the current
  set, must autosave on blur or sheet dismiss, and must never block the rest
  timer or set logging flow.
- All note writes sync to Supabase via existing `useWorkoutLogs` mutation
  paths and the Tauri offline adapter (no new sync mechanism).
- History detail view renders notes at every level they were captured.
- A search input on the history list filters sessions whose session-level,
  exercise-level, or set-level notes match the query (case-insensitive
  substring for v1; full-text indexing optional in Tech phase).
- Touch targets ≥48px; ALL-CAPS only on chip labels and section headers
  per typography conventions.
- Honors `prefers-reduced-motion`; sheet/dialog transitions respect it.

### Should

- Quick-tag chips remember "recently used" per athlete (local-only is fine)
  to surface most-relevant tags first.
- Exercise-level notes show a subtle visual affordance ("note attached") on
  the exercise card without forcing the user to open it.
- Set-level notes show a small indicator dot on the set row when present.
- Search highlights the matching note snippet in results.

### Won't (v1)

- Voice-to-text capture (native dictation via the OS keyboard is
  acceptable but not a feature we build).
- Image/video attachments on notes (separate from F007 media sharing).
- Cross-user sharing of notes; notes inherit the visibility of the parent
  session per existing RLS — no new sharing surface.
- Per-note timestamps or edit history beyond `updated_at` on the parent row.
- Markdown / rich text rendering.
- Full-text search infrastructure (pg_trgm, tsvector) — substring is
  acceptable for v1 unless Phase 2 research finds an obvious win.

## Testable Assertions

1. Given an active workout, when the user taps the note affordance on a set
   row, then a sheet opens within ≤2 taps from the set row state.
2. Given a sheet with text and a chip selected, when the sheet is dismissed,
   then the note is persisted to the local store and queued for sync without
   a save button press.
3. Given a session-level note entered pre-session, when the user starts the
   workout, then the note is visible in the active workout header area.
4. Given notes at all three levels on a completed session, when the user
   opens the history detail view, then each note renders adjacent to its
   parent (session header / exercise card / set row).
5. Given a sync failure, when the user re-opens the workout, then the local
   note is still present and the offline queue retains the write.
6. Given two sessions in history with notes containing "shoulder", when the
   user searches "shoulder" on the history list, then both sessions appear
   in results and non-matching sessions are excluded.
7. Given the rest timer is running, when the user opens the note sheet, then
   the rest timer continues uninterrupted and remains visible/audible per
   F018/F019 behavior.
8. Given a note with a quick-tag chip, when rendered in any context, then
   the chip is distinguishable without color alone (label text + shape).
9. Given an athlete with no notes on a session, when the history detail
   renders, then no empty placeholders or visual noise appears.

## Open Questions

1. **Tag taxonomy** — what is the v1 chip set? Candidates from initial
   thinking: `FORM BREAKDOWN`, `FELT HEAVY`, `FELT LIGHT`, `PR ATTEMPT`,
   `SCALED`, `SUBSTITUTION`, `PAUSED`, `GRINDY`, `FAST`, `LOW ENERGY`. Final
   list TBD in Phase 2 with input from training-modality coverage (barbell,
   CrossFit, ruck, concurrent).
2. **Tag storage shape** — store tags as a structured column (new
   `note_tags TEXT[]`) or inline-encode in the existing `notes TEXT` field
   (e.g. leading `[FORM BREAKDOWN] knees caving`)? Phase 2 decision; impacts
   migration scope and search complexity.
3. **Search scope** — history-only, or also surface in a global "find a
   note" command? v1 scope says history-only; confirm.
4. **Mid-workout sheet vs inline** — bottom sheet (matches F018 active
   workout pattern) or inline expansion under the set row? Phase 2 prototype.
5. **Relationship to manual-entry feature** — the untracked QuickPlan
   `2026-04-06-manual-workout-entry-and-edit.md` already plans a manual
   workout form that edits notes. Coordinate so this feature owns the
   note input components and the manual-entry form consumes them, rather
   than building parallel implementations.
6. **Recently-used tag persistence** — local-only (Zustand + localStorage)
   or synced (new user-prefs table)? Local-only for v1 unless trivial.

## Dependencies

- **F018 / F019 Active Workout UX** — note entry must integrate with the
  pause-gated, full-screen active workout shell without breaking the rest
  timer or finish flow.
- **Manual Workout Entry & Edit (QuickPlan)** — shares the note input
  components. This feature should land first (or in parallel with shared
  components owned here), so the manual-entry form can compose the same
  primitives.
- **Existing schema** — `workout_sessions.overall_notes`,
  `logged_activities.notes`, `logged_sets.notes` already exist
  (`supabase/migrations/20260326000001_create_phase0_tables.sql`). Any
  tag storage decision may add a column or a sibling table.
- **`useWorkoutLogs` + `data-adapter`** — write paths must already support
  partial updates to these note fields. Phase 2 must verify, otherwise
  extend the adapter.
- **Active workout Zustand store** — note entry mid-session writes through
  the active workout store, not directly to Supabase, so optimistic state
  matches the rest of the active flow.
- **History list / detail routes** — `_authenticated/history/index.tsx` and
  `_authenticated/history/$workoutId.tsx` for rendering and search.

## Out of Scope

See "Won't (v1)" above. Notably: no markdown, no media on notes, no custom
tags, no per-note edit history, no cross-user sharing.
