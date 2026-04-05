# ADR-009: Orphaned Override Key Handling

**Date:** 2026-04-05
**Status:** Proposed
**Feature:** 013-Session-Instance-Editing

## Context

When a coach or user modifies a session template (removes or reorders activities) after a trainee has already saved per-instance overrides, those overrides reference activity IDs that no longer exist in the template. Currently, `applyOverrides` in `override-merger.ts` silently skips these orphaned keys. The user's customizations disappear without any indication.

## Decision

1. Add `console.warn('[override-merger] Orphaned override key: ...')` logging in `applyOverrides` when an override key does not match any activity in the resolved groups. This aids debugging without breaking the workout flow.
2. Do NOT surface orphaned overrides to the end user in v1. The override merger is called at workout-start time, and showing a warning mid-launch adds UX complexity with marginal benefit.
3. Revisit user-facing notification in a future iteration if telemetry shows orphaned overrides are common (indicating frequent template edits after scheduling).

## Consequences

- Developers get visibility into orphaned overrides via console warnings.
- No user-facing disruption at workout start.
- Future work can add a UI banner in the session edit sheet if needed (e.g., "Some of your customizations no longer apply because the template changed").
- The override map may accumulate stale keys over time -- consider a cleanup pass when re-opening the session edit sheet.
