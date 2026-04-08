# ADR-014: `note_tags` Validation Layering -- Application Zod with Defense-in-Depth DB CHECK

**Date:** 2026-04-07
**Status:** Proposed
**Feature:** 020-Workout-Notes

## Context

F020 introduces a `note_tags TEXT[]` column on `workout_logs` (Supabase migration `20260406140000_add_note_tags.sql`) and `workout_note_tags` table on Tauri (`src-tauri/migrations/013_workout_note_tags.sql`). Per-element constraints (non-empty, max length 32 characters, max 16 tags per note) are enforced only at the application layer via Zod schemas.

Direct SQL writes -- admin tools, future server functions, backfills, manual psql sessions -- bypass Zod entirely. PR #92 review (P14-018) flagged this as a Medium-severity layering gap.

## Decision

Add database-level CHECK constraints as a defense-in-depth layer on both Supabase and Tauri SQLite, while keeping Zod as the primary validation point for user input.

- **Supabase migration (new):** Add `CHECK (cardinality(note_tags) <= 16 AND NOT EXISTS (SELECT 1 FROM unnest(note_tags) t WHERE length(t) = 0 OR length(t) > 32))` to `workout_logs`.
- **Tauri SQLite migration (new):** Add `CHECK (length(tag) > 0 AND length(tag) <= 32)` on `workout_note_tags.tag` and a trigger or application-side count guard for the 16-tag cap (SQLite CHECK cannot easily reference sibling rows).
- **Application layer:** Zod schemas remain the canonical source of constraints. The DB constraints are duplicates intentionally, kept in sync via documentation in `Context/Features/020-Workout-Notes/Tech.md`.

## Rationale

- **Defense in depth.** A future ETL job, admin script, or unsafe RPC cannot silently insert garbage tag data.
- **Cheap to add.** CHECK constraints are O(1) per insert and O(rows) one-time on migration.
- **Zod stays canonical.** UX-quality error messages still come from Zod; the DB layer only catches non-UI writers.
- **Aligns with existing practice.** Other domain constraints in the schema (e.g., set count caps, ordinal non-negativity) follow the same pattern.

## Consequences

- Two new migrations required (one Supabase, one SQLite). Tracked as a follow-up task in F020 Steps.md (P14-018).
- Schema documentation in `Context/Features/020-Workout-Notes/Tech.md` must explicitly note the duplicated constraint and the rationale, so future maintainers do not "clean up" the perceived redundancy.
- The 16-tag cardinality cap on SQLite cannot be enforced via row-level CHECK; either a trigger or accepting application-only enforcement for that single rule is the trade-off. Recommendation: trigger on insert/update of `workout_note_tags`.

## Alternatives Considered

- **Application-only enforcement (status quo).** Rejected. The review correctly identifies that any non-Zod writer bypasses validation, and bad data is far harder to remove than to reject.
- **Move all validation to the DB layer.** Rejected. Zod gives field-level UX errors; SQL CHECK errors surface as opaque constraint-violation strings.
- **Stored procedures as the only write path.** Out of scope; would require restructuring the entire write-path architecture.
