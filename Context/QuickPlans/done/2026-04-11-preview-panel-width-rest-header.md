---
date: 2026-04-11
status: draft
---

# Quick Plan: Preview Panel — Width Fix, Rest Visibility, Header Polish

## Task
Three targeted fixes to `template-preview-panel.tsx` and `exercise-picker-drawer.tsx`:
1. Correct the drawer right-offset so it doesn't overlap the preview column
2. Surface `restBetweenRounds` and `restBetweenActivities` in the group header
3. Polish the preview panel header text treatment

## Goal
The live preview panel is already implemented and wired. These three changes make it *correct* (no overlap bug), *complete* (rest timing is the athlete's primary concern), and *polished* (header text size matches system conventions).

---

## Issue 1: Drawer right-offset miscalculation

### Problem
`exercise-picker-drawer.tsx` has `xl:right-[260px]`. The outer layout wrapper (`template-editor-layout.tsx`) applies `lg:px-8` (32px). The preview grid column is `280px` at xl, `320px` at 2xl.

Fixed drawer offset to clear the preview:
- xl: 32px (outer padding) + 280px (column) = **312px**
- 2xl: 32px (outer padding) + 320px (column) = **352px**

Current `xl:right-[260px]` leaves a 52px drawer-over-preview overlap at every viewport width.

### Fix
**File:** `src/components/session-builder/exercise-picker-drawer.tsx:78`

```diff
- 'lg:inset-y-0 lg:right-0 lg:left-auto lg:top-0 lg:h-[100dvh] lg:max-h-none lg:w-[400px] xl:right-[260px]',
+ 'lg:inset-y-0 lg:right-0 lg:left-auto lg:top-0 lg:h-[100dvh] lg:max-h-none lg:w-[400px] xl:right-[312px] 2xl:right-[352px]',
```

---

## Issue 2: Rest timing not shown in preview

### Problem
The preview renders `group.rounds` but not `restBetweenRounds` or `restBetweenActivities`. Rest timing is the primary scheduling concern for athletes reading the scorecard.

### Fix
**File:** `src/components/session-builder/template-preview-panel.tsx`

In the group `<header>` block (currently lines 105–114), after the rounds badge, append rest chips when set:

```tsx
{group.restBetweenRounds && (
  <span className="font-display text-[10px] uppercase tracking-wider text-warm-ash/50">
    {formatSeconds(group.restBetweenRounds.seconds)} rest/rnd
  </span>
)}
{group.restBetweenActivities && (
  <span className="font-display text-[10px] uppercase tracking-wider text-warm-ash/50">
    {formatSeconds(group.restBetweenActivities.seconds)} rest/ex
  </span>
)}
```

`formatSeconds` is already imported from `@/components/program-builder/session-detail-utils`.

The `ActivityGroupData` type already carries `restBetweenRounds?: Duration` and `restBetweenActivities?: Duration` — no prop changes needed.

---

## Issue 3: Preview panel header text

### Problem
- `"Preview"` renders at `text-[10px]` — smaller than the system minimum of `text-[11px]` used for all other sub-header labels in the builder.
- `"as seen on gym floor"` at `text-warm-ash/40` is barely legible; `/50` or `/60` would still be subtle but scannable.

### Fix
**File:** `src/components/session-builder/template-preview-panel.tsx` (lines 61–66)

```diff
- <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-bone-white">
+ <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-bone-white">
    Preview
  </span>
- <span className="font-display text-[10px] uppercase tracking-wider text-warm-ash/40">
+ <span className="font-display text-[11px] uppercase tracking-wider text-warm-ash/50">
    as seen on gym floor
  </span>
```

---

## Files Touched
| File | Change |
|------|--------|
| `src/components/session-builder/exercise-picker-drawer.tsx` | Correct xl/2xl right-offset |
| `src/components/session-builder/template-preview-panel.tsx` | Rest chips in group header + header text bump |

## Verification
- [ ] At xl viewport (1280px), open exercise picker — drawer right edge stops at preview column left edge, no overlap
- [ ] At 2xl (1536px+), same check with 320px preview column
- [ ] Add a group with CIRCUIT type, set 4 rounds and 2:00 rest/round — preview shows "4 Rounds  2:00 rest/rnd"
- [ ] Add rest between activities — shows "1:30 rest/ex" in group header
- [ ] Groups with no rest set show unchanged (chips absent)
- [ ] `bun run build` and `bun run test` pass

## Risks
- `formatSeconds` formats rest as `"2:00"` — confirm that reads clearly at `text-[10px]`. Acceptable since all other preview text is the same size.
- At very narrow xl viewports (exactly 1280px), the drawer at `right-[312px]` with 400px width = 712px total anchor from right. With a 1216px content area this is fine (drawer left edge at ~568px, well inside the 1fr column). No overflow risk.
