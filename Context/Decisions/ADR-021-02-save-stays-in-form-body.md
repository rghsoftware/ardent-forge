# ADR-021-02: Keep save/cancel inside the form body

**Status:** Proposed
**Date:** 2026-04-11
**Feature:** 021 -- Template Builder Route

## Context

Should the header "save" button be hoisted out of `SessionTemplateForm` / `EventTemplateForm`? The new full-page route layout has a header slot that could plausibly host save/cancel controls, raising the question of whether form internals should be exposed imperatively to the route shell.

## Decision

No. The form owns its save/cancel buttons. The route-level header is purely navigational.

## Alternatives Considered

- `useImperativeHandle` to expose `save()` from the form and render a header-level save button. Rejected because it adds coupling between layout and form internals and requires touching form code + tests for no functional gain.
- Duplicate save buttons in header and form body. Rejected as clutter.

## Consequences

- `TemplateEditorLayout` has no save-button slot; the header renders `← Library` + title only.
- Form internals, props, and tests remain unchanged.
- A future iteration can lift save into the header if needed (tracked as backlog, not a blocker).
