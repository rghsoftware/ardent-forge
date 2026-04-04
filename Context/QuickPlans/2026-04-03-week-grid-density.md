# Quick Plan: Week Grid Density Improvements

**Task:** Three UX improvements to reduce visual noise in the program builder week grid without losing the spatial calendar metaphor.

**Goal:** Make the grid feel intentional and complete rather than sparse and unfinished, especially on mobile and in multi-week blocks.

---

## Change 1: Mobile 5/7-day toggle

**Where:** `src/routes/_authenticated/builder.tsx` + `src/components/program-builder/mobile-block-editor.tsx`

**What:** The `showWeekends` state already exists in the builder route and already flows to `BlockList` (desktop). It is never passed to `MobileBlockEditor`. `MobileDayRow` hardcodes `DAY_ORDER` ([1,2,3,4,5,6,0]) with no filtering.

**Approach:**
1. Pass `showWeekends` and `onToggleWeekends` down to `MobileBlockEditor` as props.
2. Add the toggle button to the mobile block editor header (currently has block controls — add the same "5 days / 7 days" toggle button that desktop uses, but visible on mobile).
3. In `MobileWeekSection`, filter `DAY_ORDER` to `WEEKDAY_COLUMNS` when `showWeekends=false`, same logic as `WeekGrid`.
4. If a weekend session exists on a week where weekends are hidden, show the same "+N weekend session(s)" note that `WeekGrid` already shows.

**Files:**
- `src/routes/_authenticated/builder.tsx` -- pass props to MobileBlockEditor
- `src/components/program-builder/mobile-block-editor.tsx` -- accept props, add toggle button, filter day list

---

## Change 2: Rest day visual treatment

**Where:** `src/components/program-builder/session-slot.tsx` (desktop) + `MobileDayRow` in `mobile-block-editor.tsx`

**What:** Empty slots currently look like unfilled calls-to-action (dashed border, `+` icon). This reads as "something is missing" rather than "this is a rest day". The fix is a subtle visual that reads as intentional without removing the ability to assign a session.

**Approach:**
- Replace the dashed-border `+` button for empty slots with a quieter treatment: no border, muted background (`bg-surface-gunmetal/40` or similar), and a small "Rest" label in `text-warm-ash/30` instead of a `+` icon.
- Keep the slot fully interactive -- clicking still opens the picker. Add a hover state that reveals the `+` icon to indicate it's assignable.
- On mobile, the empty `MobileDayRow` currently says "Tap to assign" -- replace with just the day label and a very muted right-side `+` that appears on hover/focus.

**Files:**
- `src/components/program-builder/session-slot.tsx` -- restyle empty state
- `src/components/program-builder/mobile-block-editor.tsx` -- restyle empty `MobileDayRow`

---

## Change 3: Collapse identical weeks

**Where:** `src/components/program-builder/block-editor.tsx` (desktop) + `mobile-block-editor.tsx` (mobile)

**What:** In a 4-week block where weeks 2-4 repeat week 1's pattern (common in linear progression programs), each week currently renders full height. This triples the vertical space with duplicate structure.

**Approach:**
- Add a `weekMatchesPrevious(week: WeekDraft, previous: WeekDraft): boolean` utility in `builder-state.ts` that compares session arrays by `dayOfWeek` and `sessionTemplateId`.
- In `BlockEditor` and `MobileBlockCard`, for any week where `weekMatchesPrevious` is true, render a collapsed summary row instead of the full grid: "Week N -- same as Week 1" with an expand chevron.
- The collapsed row should still show the session count and type badges (e.g., "3 sessions: STR / COND / SE") so the user knows what's in the week without expanding.
- Clicking the row or chevron expands it to the full grid inline. State is local (`expandedWeeks: Set<string>`) in `BlockEditor`.
- Default: all weeks expanded. The collapse only applies when `weekMatchesPrevious` returns true, so a new empty block always shows all weeks expanded.

**Files:**
- `src/components/program-builder/builder-state.ts` -- add `weekMatchesPrevious` utility
- `src/components/program-builder/block-editor.tsx` -- render collapsed summary for matching weeks
- `src/components/program-builder/mobile-block-editor.tsx` -- same for mobile

---

## Verification

- Mobile builder shows 5-day grid by default; toggle switches to 7-day
- Weekend sessions on a 5-day mobile view show the "+N weekend" note
- Empty slots read as rest days visually; hover/focus reveals the assignable state
- A 4-week block where weeks 2-4 are identical renders collapsed "same as Week 1" rows
- Expanding a collapsed week shows the full grid
- A block with all different weeks renders fully expanded with no collapsed rows

## Risks

- **Change 3 interaction with remove/assign**: When a week is collapsed and the user assigns or removes a session elsewhere that makes the week no longer identical, it should auto-expand. Need to invalidate the collapsed state in `handleSessionSelected` and `handleRemoveSession`.
- **Change 2 hover on touch devices**: "hover to reveal +" won't work on mobile tap. The empty mobile row should always show a subtle `+` since there's no hover state.
- **Change 1 weekend sessions note position**: On mobile the note goes below `MobileWeekSection` header, not below a horizontal grid row — needs a different placement than desktop.
