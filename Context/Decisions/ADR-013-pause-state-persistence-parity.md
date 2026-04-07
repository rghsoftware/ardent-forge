# ADR-013: Pause State Persistence Parity Across Supabase and Tauri Adapters

**Date:** 2026-04-07
**Status:** Proposed
**Feature:** 018-Workout-Session-UX

## Context

F018 introduces a first-class "paused workout" state with two new columns on `workout_logs`:

- `paused_at` (timestamp, nullable) -- when the user paused the live session
- `total_paused_ms` (bigint) -- accumulated paused duration across pause/unpause cycles

The Supabase migration `20260406130000_add_workout_log_pause_columns.sql` ships these columns and the Supabase adapter persists them. The Tauri adapter (`src/lib/tauri-adapter.ts:647-648`) hardcodes `paused_at: null, total_paused_ms: 0` and the corresponding Rust commands (`src-tauri/src/commands/workout_logs.rs`) never accept or store pause fields. A code comment marks this as "Pause state deferred for Tauri offline mode (F018)".

The mobile (Tauri) target is the **primary** surface for live workout logging. Users will pause workouts at the gym on mobile far more often than on web. With the current code, any pause/unpause cycle on Tauri silently disappears on app reload or crash recovery, and `totalPausedMs` resets to 0, causing the elapsed timer to be permanently overstated. PR #92 review (P14-001, P14-017) flagged this as a Critical data-integrity issue and the leading platform-divergence risk in the feature.

## Decision

Ship pause state persistence to the Tauri adapter to achieve full parity with Supabase. The persistence layer is the source of truth on both platforms; pause is not a platform-optional capability.

Concretely:

1. Add a SQLite migration in `src-tauri/migrations/` that introduces `paused_at INTEGER` and `total_paused_ms INTEGER NOT NULL DEFAULT 0` columns on `workout_logs`.
2. Update the Rust workout-log commands (`create_workout_log`, `update_workout_log`, `get_workout_log`) to accept, persist, and return pause fields.
3. Update `src/lib/tauri-adapter.ts` `toWorkoutLogRow` and the corresponding row->domain conversion to round-trip pause fields with the same semantics as Supabase (warn-on-fallback, no silent coercion).
4. **Interim (this PR):** Until the persistence work lands, the Tauri pause UI must be hidden and a one-shot warning logged. This is the immediate FIX for P14-001.

## Rationale

- **Mobile is primary.** Deferring pause persistence on the primary platform is a contradiction with the feature's stated goals.
- **Data integrity, not feature scope.** Once pause UI exists at all, partial persistence is worse than no feature -- users trust the timer.
- **Parity reduces cognitive load.** The domain layer should not need to branch on adapter capability for a core workout state field. A `pauseStateSupported` capability flag would propagate platform branching into UI, hooks, and tests.
- **Migration cost is bounded.** Adding two nullable/defaulted columns to SQLite plus updating three commands is well-understood work, comparable to other recent Tauri parity migrations.

## Consequences

- Net new SQLite migration + Rust command updates required (tracked as task in F018 Steps.md, see P14-001 / P14-017 entries).
- Round-trip tests required in `src/lib/__tests__/tauri-adapter.test.ts` for pause field persistence.
- Until the persistence work lands, the interim Tauri pause-UI gate adds a small amount of platform-conditional code in `log.$workoutId.tsx` that will be removed when the migration lands.
- Crash recovery on Tauri will correctly restore `pausedAt` and `totalPausedMs` once persistence ships, removing P14-002's class of bugs at the source on mobile.

## Alternatives Considered

- **Add a `pauseStateSupported` capability flag and gate UI permanently.** Rejected. Bakes platform divergence into the domain layer for what is a temporary implementation gap.
- **Persist pause state in Tauri's local Zustand `persist` middleware only (not SQLite).** Rejected. Zustand persist is process-local browser storage; it does not survive app reinstalls and is not the system of record. Source-of-truth must be SQLite to match Supabase semantics.
- **Defer pause UI on Tauri entirely until full implementation.** This is the chosen interim posture. The ADR commits to closing the gap, not leaving it open.
