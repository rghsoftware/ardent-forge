# Quick Plan: Template Builder UX Polish (Round 2)

**Date:** 2026-04-11

---

## Task

Address nine UX observations from a review pass of the template builder workflow. Items are triaged into three tiers: fix now, defer to backlog, and noted-only.

---

## Fix Now (5 items)

### 1. Preview panel ember hierarchy — `template-preview-panel.tsx:77,106`

**Problem:** Category label (`text-ember`) and group type headers (`text-ember`) are brighter than the preview panel's own header (`text-warm-ash/80`). Data wins over chrome — hierarchy is inverted.

**Decision:** Raise the preview header, not tone down the data. The preview is intentionally a gym-floor readout; ember on active data is correct. The header label at `template-preview-panel.tsx` (the "PREVIEW" or similar chrome above the panel) should step up to `text-bone-white` so it reads above the ember data rows.

**Change:** `template-preview-panel.tsx` — check the panel header text color and step it up.

---

### 2. CollapsedFieldsRow discoverability — `collapsed-fields-row.tsx:51`

**Problem:** Trigger label is `text-xs uppercase text-warm-ash` — easily missed. Users won't know Scoring/TimeCap fields exist unless they hunt.

**Decision:** Add `text-warm-ash/80` (slight bump) and prefix the label with `"OPTIONAL: "` when collapsed, so it reads `"OPTIONAL: Scoring, Time Cap ▾"`. Prepend in the component when `!expanded`, using the existing `labels` array.

**Change:** `collapsed-fields-row.tsx` — conditional "OPTIONAL: " prefix on the span text when collapsed.

---

### 3. ExerciseRow inline material-symbols span — `exercise-picker-panel.tsx:103`

**Problem:** Uses raw `<span className="material-symbols-outlined ...">fitness_center</span>` instead of `<Icon name="fitness_center" size={20} />`.

**Change:** Direct swap. Also add the `Icon` import if not present.

---

### 4. Save button copy — `session-template-form.tsx:673`

**Problem:** "Resolve issues above" is directionally ambiguous — error summary may render below on some viewports.

**Change:** Replace with `"Resolve errors"` — location-neutral and concise.

---

### 5. "Show all types" affordance — `set-scheme-editor.tsx:236-243`

**Problem:** Bare-text button in `text-warm-ash` is too subtle. Users filtered by category (e.g., STRENGTH) may not realize a filter is acting on them.

**Decision:** Option (b) — promote the button. Change to `bg-surface-charcoal/60 px-2 py-1 text-warm-ash/90 hover:text-bone-white` to give it a visible pill background, making it look like an actionable chip rather than ambient copy.

**Change:** `set-scheme-editor.tsx:236-243` — add pill background classes to the `<button>`.

---

## Defer to Backlog (1 item)

### 6. Mobile preview — no summary bar on mobile/lg

**Problem:** Preview panel is `xl:flex` only. On mobile, there is no feedback loop for "what am I building?"

**Decision:** Defer. A collapsible summary bar or sticky header with `(N groups / M exercises)` requires new state threading and layout work that exceeds a quick-plan scope. Add to backlog.

**Action:** Create `Context/Backlog/template-builder-mobile-preview-summary.md`.

---

## Noted Only — No Action (3 items)

### 7. ExercisePickerDrawer mobile/desktop dismissal asymmetry

ADR-021-03 intentionally allows desktop to be scrim-less. ESC handler is consistent; close button present. No change needed.

### 8. Dirty snapshot JSON.stringify comparison (`session-template-form.tsx:275`)

Works correctly today. Fragile only if field key order changes. Leave until form grows; no change now.

### 9. "Session" label overload (mode vs category)

Terminology ambiguity between outer mode (`session` vs `event`) and inner category (`STRENGTH`, etc.). Not a UI fix — requires copy/taxonomy decision. Add a single sentence to backlog as a future information architecture review item.

---

## Approach

All five fix-now items are independent single-file edits. Execute directly without sub-agent orchestration.

**Order:**
1. `exercise-picker-panel.tsx` Icon swap (trivial, no design judgment)
2. `session-template-form.tsx` copy change (trivial)
3. `template-preview-panel.tsx` header hierarchy
4. `collapsed-fields-row.tsx` optional prefix
5. `set-scheme-editor.tsx` show-all-types pill

After fixes, create one backlog file for mobile preview summary.

---

## Verification

- [ ] `exercise-picker-panel.tsx` — no raw `material-symbols-outlined` span, `<Icon />` used
- [ ] `session-template-form.tsx:673` — label reads `"Resolve errors"` not `"Resolve issues above"`
- [ ] `template-preview-panel.tsx` — panel chrome header outranks ember data rows visually
- [ ] `collapsed-fields-row.tsx` — collapsed state shows "OPTIONAL: Scoring, Time Cap" prefix
- [ ] `set-scheme-editor.tsx` — "Show all types" has visible pill background, not bare text
- [ ] Backlog file created for mobile preview summary

---

## Risks

- "OPTIONAL: " prefix may be too long on narrow viewports — can truncate with `truncate` class if needed
- Pill background on "Show all types" should not look like a primary CTA — use charcoal, not ember
