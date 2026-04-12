# Template builder draft persistence and unsaved-changes guard

**Source:** UX audit -- template builder polish (2026-04-11)
**Date:** 2026-04-11
**Status:** Backlog

## Context

`SessionTemplateForm` holds all form state in local React `useState`. There is
no persistence layer. Closing the sheet mid-edit (tapping outside, navigating
away, or refreshing the browser) silently discards all in-progress work. For a
form that can represent 20+ minutes of template authoring -- multiple groups,
exercises, set schemes, rest periods -- this is a significant data-loss risk.

The form is rendered inside a bottom sheet (`library.tsx`), which compounds the
problem: the sheet close gesture is easy to trigger accidentally on mobile.

## Proposed work

### 1. Auto-save draft to localStorage

Create a `useSessionTemplateDraft` hook that:
- Subscribes to all form state changes and persists a debounced snapshot to
  `localStorage` under a stable key (`session-template-draft` for new templates,
  `session-template-draft:${templateId}` for edits)
- Exposes a `hasDraft` boolean and a `clearDraft()` function
- On mount, checks for a stored draft and optionally hydrates form state

The hook should live alongside the form in
`src/components/session-builder/use-session-template-draft.ts`.

### 2. Draft hydration on sheet open

When the sheet opens for a new template, check for a stored draft. If one exists,
offer the user a choice: "Resume draft" or "Start fresh". On "Start fresh", call
`clearDraft()`. For edit mode, only resume if the draft's `templateId` matches.

### 3. Unsaved-changes guard on sheet close

When the user attempts to close the sheet (via the X button or outside tap) and
`isDirty` is true (form differs from initial/saved state), intercept the close
and show a confirmation:

> "You have unsaved changes. Close anyway?"

Actions: "Keep editing" (dismiss) / "Discard changes" (close + clearDraft).

On successful save, `clearDraft()` is called automatically.

### 4. Clear draft on successful save

After `createMutation` or `updateMutation` resolves successfully, call
`clearDraft()` so stale drafts don't resurface on the next open.

## Acceptance

- Refreshing the browser mid-edit and reopening the sheet offers draft resume
- Closing the sheet with unsaved work shows a confirmation dialog (not a silent close)
- Saving the template clears the draft
- Draft is scoped per template (new vs. edit) -- editing template A does not
  offer template B's draft
- `bun run build` passes with no new TypeScript errors
