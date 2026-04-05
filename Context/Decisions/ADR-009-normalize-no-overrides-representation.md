# ADR-009: Normalize "No Overrides" Representation

**Date:** 2026-04-05
**Status:** Proposed
**Feature:** 013-Session-Instance-Editing

## Context

`ScheduledSession.overrides` currently accepts four representations of "no overrides":

- `undefined`
- `null`
- `{}`
- `{ activityOverrides: {} }`

Every consumer (`override-merger.ts`, `session-edit-sheet.tsx`, `builder-state.ts`, `data-mapper.ts`) must defensively handle all four variants. This increases surface area for bugs and makes the code harder to reason about.

## Decision

1. Narrow the domain type from `.optional().nullable()` to `.optional()` only, with `undefined` as the canonical "no overrides" value.
2. Create a `normalizeOverrides()` utility in `src/lib/override-merger.ts` that collapses `null`, `{}`, and `{ activityOverrides: {} }` to `undefined`.
3. Call `normalizeOverrides()` at the adapter boundary (`data-mapper.ts`) so downstream code only sees `SessionOverrides | undefined`.
4. Simplify `override-merger.ts` early-return logic (lines 41-43) once normalization is guaranteed upstream.

## Consequences

- Adapter layer (`data-mapper.ts`) becomes the single normalization point for overrides.
- All downstream consumers can drop null checks for `null`, `{}`, and `{ activityOverrides: {} }`.
- Existing stored data with `null` overrides continues to work via the adapter normalization.
- Migration: no data migration needed -- normalization happens at read time.
