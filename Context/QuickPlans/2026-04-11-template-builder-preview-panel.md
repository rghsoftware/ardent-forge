---
date: 2026-04-11
status: draft
---

# Quick Plan: Template Builder Right-Column Preview

## Task
Add a live right-column preview panel to the template builder that renders the template as it will appear on the gym floor, giving athletes the same contextual feedback the program builder's time-travel view provides.

## Goal
The two-column grid (`320px metadata | 1fr groups editor`) earns its keep on large screens by adding a third column: a live preview that reacts as the user edits groups and activities, eliminating the "design blind" problem the program builder solves with time travel.

## Key Discovery
`src/components/workout/session-template-preview.tsx` already exists and renders exactly the right content (group headers with type/rounds badges, exercise rows with sets × reps × load). The work is wiring it into the builder as a live preview, not building it from scratch.

## Approach

### 1. Restructure the grid in `session-template-form.tsx`
Current: `lg:grid-cols-[320px_1fr]` (2 columns)
New: `xl:grid-cols-[300px_1fr_320px]` (3 columns at xl breakpoint)
- Keep 2-column layout at `lg` (preview panel hidden below xl)
- Left col (sticky): template metadata form (shrink slightly to 300px)
- Middle col: activity groups editor (unchanged)
- Right col (sticky): live preview panel

### 2. Build `TemplatePreviewPanel` component
New file: `src/components/session-builder/template-preview-panel.tsx`

Props: `{ template: SessionTemplateDraft }` where `SessionTemplateDraft` is the
in-memory form state (name, category, groups with activities).

Renders:
- **Panel header:** "PREVIEW" badge + "AS SEEN ON GYM FLOOR" subline (ALL-CAPS, surface-steel bg)
- **Template header block:** name, category badge, scoring type, time cap if set
- **Group list:** reuses `SessionTemplatePreview` rendering logic (or imports the component directly after adapting its props signature)
- **Empty state:** "ADD A GROUP TO SEE PREVIEW" when no groups exist

Design constraints:
- `bg-surface-pit` panel background (one step darker than form body)
- Sticky within column: `lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto`
- Hard edges, tonal depth -- no borders, no shadows

### 3. Thread live state into the panel
`SessionTemplateForm` already owns all form state. Pass it down:
```tsx
<TemplatePreviewPanel
  name={name}
  category={category}
  scoring={scoring}
  timeCap={timeCap}
  groups={groups}          // full in-memory group+activity tree
  exercises={exercises}    // exercise lookup map for display names
/>
```

The `exercises` lookup already exists in `session-template-form.tsx` (used for activity rows) -- reuse it.

### 4. Exercise name resolution
`SessionTemplatePreview` currently works from persisted data with exercise names already resolved. The builder works with `exerciseId` references. Pass the `exercises` map to the preview and resolve names inline during render (same pattern used in `ActivityGroupEditor`).

## Files Touched
| File | Change |
|------|--------|
| `src/components/session-builder/session-template-form.tsx` | Grid restructure, pass state to preview panel |
| `src/components/session-builder/template-preview-panel.tsx` | **New** -- live preview panel component |
| `src/components/workout/session-template-preview.tsx` | Possibly adapt props to accept unresolved exercise IDs + lookup map |

## Verification
- [ ] Preview panel visible at xl breakpoint, hidden at lg and below
- [ ] Preview updates live as groups/activities are added, edited, removed
- [ ] Empty state renders when no groups exist
- [ ] Template name, category, scoring, time cap display correctly in preview header
- [ ] Group type badges and round counts match what the gym-floor display shows
- [ ] Sticky behavior: panel scrolls independently if content exceeds viewport

## Risks
- `SessionTemplatePreview` may have a props signature tightly coupled to persisted `SessionTemplate` type -- may need a lightweight adapter type or a second render path for in-progress draft data
- Three-column layout at xl may feel crowded on 1280px screens -- may need to drop the preview behind a toggle button at lg (show/hide) as a fallback

## Execution
`/impl`
