# ADR-012: Transactional Adapter Method for Manual Workout Edit Save

**Date:** 2026-04-07
**Status:** Proposed
**Feature:** 018-Workout-Session-UX (Manual Workout Entry/Edit form)

## Context

The manual workout edit form (`src/components/workout/manual-workout-form.tsx:607-833`) computes a diff between the loaded workout and the edited form state, then issues sequential delete/upsert mutations against `useUpdateWorkoutLog`, `useUpdate/DeleteLoggedActivity`, `useUpdate/DeleteLoggedActivityGroup`, and set-level mutations.

If any mutation in the middle of the diff fails (RLS rejection, network drop, stale id, Zod coercion error inside `toWeight`/`toDistance`), the database is left in a partially-applied state. The user receives a generic toast ("Some changes may have been partially applied. Reload to see the current state.") with no entity context and no way to retry safely. Re-submitting the form would re-issue already-applied mutations, compounding the corruption.

The PR #92 review (P14-016) flagged this as a Critical data-integrity risk.

## Decision

Introduce a transactional `updateWorkoutLogFull(diff)` method on the `DataAdapter` interface. Both Supabase and Tauri implementations must apply the entire edit diff atomically, returning the updated workout on success or a structured error on failure (with no partial application).

- **Supabase:** Implement via a single Postgres RPC (`update_workout_log_full(payload jsonb)`) that wraps the diff in a transaction. The RPC validates the payload, applies deletes/updates/inserts in dependency order (sets → activities → groups → log), and returns the refreshed log.
- **Tauri:** Implement via a single Rust command that opens a sqlx transaction, applies the same operations against SQLite, and commits or rolls back as a unit. Reuse existing `WorkoutLogDiff` shapes from the domain layer.
- **Form layer:** `manual-workout-form.tsx` switches from per-entity sequential mutations to a single `useUpdateWorkoutLogFull` mutation. The diff computation already exists; only the dispatch path changes.

## Rationale

- **Correctness over performance.** A single round-trip with all-or-nothing semantics is the only way to give the user a reliable retry path.
- **Symmetry across adapters.** Both Supabase and Tauri/SQLite support transactions natively; there is no architectural reason to accept best-effort semantics.
- **Simpler error surface.** A single mutation collapses 6+ `onError` handlers into one. The user-facing error becomes a clean "Save failed -- no changes were applied. Please retry."
- **Future edits are cheap.** Adding new edit operations becomes a payload-shape change rather than another sequential mutation.

## Consequences

- Requires a new Supabase migration introducing the `update_workout_log_full` RPC plus its RLS guards (caller must own the workout log).
- Requires a new Tauri command (`update_workout_log_full`) and SQLite migration parity work in `src-tauri/src/commands/workout_logs.rs`.
- Domain layer needs a `WorkoutLogDiff` zod schema (deletes, updates, inserts grouped by entity type) shared by both adapters.
- The existing per-entity mutation hooks (`useUpdateLoggedActivity`, etc.) remain available for callers that legitimately need single-entity edits; the manual edit form simply stops using them for compound saves.
- Implementation is non-trivial; tracked as follow-up tasks in F018 Steps.md (see P14-016 task entries).

## Alternatives Considered

- **Best-effort + entity-id logging.** Rejected. Even with better diagnostics, the user has no safe retry path and the database can drift indefinitely.
- **Client-side rollback by replaying inverse mutations.** Rejected. Inverse mutations can themselves fail and the failure modes compound; cannot guarantee convergence.
- **Optimistic locking via `updatedAt` checks.** Useful as a defense layer but does not solve partial-application; complementary, not a substitute.
