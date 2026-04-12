# Template Builder: Mobile Preview Summary Bar

## Problem

The live preview panel is `xl:flex` only. On mobile and lg breakpoints, the user gets no feedback on what they're building — no group count, no exercise count, no category summary.

## Proposed Solutions

**Option A: Collapsible preview panel**
A `"▸ Preview"` toggle at the top of the form that expands inline, scrolling with the page. Mirrors the desktop preview content but in a compact form.

**Option B: Sticky summary bar**
A fixed bar below the page header (or at the top of the form) that shows `"N groups / M exercises"` in real time. Cheap to implement — reads from the same in-memory form state as the desktop preview.

Option B is lower complexity and directly addresses the feedback loop problem without requiring a full collapsible panel. Recommended starting point.

## Acceptance Criteria

- Mobile users can see a running count of groups and exercises as they build
- Summary updates in real time (no save required)
- Does not interfere with the form layout or touch targets

## Notes

- Preview panel state already lives in the parent form component; no new server fetches required
- The `TemplatePreviewPanel` component already has the calculation logic (`populatedGroups`)
- A summary bar could reuse a lightweight slice of that logic
