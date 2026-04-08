# Backlog: gym management pagination

**Source:** Spec.md S8 / RD-19 / M22 / M24 (F018)
**Captured:** 2026-04-07 (P14-048 review resolution)
**Status:** Not started

## Context

The "Browse all gyms" list in `src/components/profile/gym-management-section.tsx`
ships unpaginated. The underlying SQL query and the `idx_gym_members_user_gym`
index are shape-compatible with `LIMIT`/`OFFSET`, so adding pagination later
is a half-day change rather than a refactor.

## Trigger

Add pagination only when a friends-and-family instance exceeds ~50 gyms.
Below that threshold, a flat list is faster, has no UX cliff, and avoids
adding state for the page index.

## Implementation sketch

1. Add `LIMIT 50 OFFSET ?` to `useAllGyms` (or accept a `page` arg).
2. Add Prev/Next buttons in `BrowseAllGymsList`.
3. Update the test that asserts the empty-list path to also exercise the
   "more pages available" indicator.

## Why this is in the backlog and not Steps.md

This is a future enhancement gated on a real instance scaling, not an open
feature task. Captured here so the discussion doesn't get lost when the
TODO comment in the source file eventually gets cleaned up.
