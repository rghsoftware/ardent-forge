# ADR-021-03: Drawer vs sheet for the exercise picker

**Status:** Proposed
**Date:** 2026-04-11
**Feature:** 021 -- Template Builder Route

## Context

Spec Q3 + M4 -- how to render the exercise picker without nesting sheets? The existing `AddExerciseSheet` is a radix `Sheet` portal. Rendering it from inside another sheet (the current template editor) is the anti-pattern F021 exists to unwind, and re-using a modal portal for long-running creative work defeats the point of moving to a dedicated route.

## Decision

A route-local `ExercisePickerDrawer` component that is a plain `<aside>` with fixed positioning (`lg:inset-y-0 lg:right-0 lg:w-[400px]`) on desktop and a full-width inline panel on mobile. Not a radix `Dialog` / `Sheet` portal.

## Alternatives Considered

- Inline-expanding panel that replaces the activity row during selection. Rejected because it loses search context when the user is building a long group and obscures the group's other rows.
- A true `<Sheet side="right">` instead of `side="bottom"`. Rejected because a sheet is still a modal portal; layering it over a sheet-less route is fine, but the point is to avoid the modal pattern entirely for sustained creative work.

## Consequences

- A small amount of CSS work to get the drawer transition right on mobile (full-width slide-up) and desktop (slide-in from right).
- The drawer can be dismissed via: (a) Escape key, (b) a dedicated close button, (c) tapping outside on mobile. On desktop, tapping outside does **not** dismiss because the drawer is not modal -- the main form remains interactive behind/beside it. This is intentional: the user can continue editing while the drawer is open.
