# Quick Plan: Template Builder UX Polish

**Task:** Fix 8 identified UX issues in the session template builder  
**Goal:** Typography, button hierarchy, layout, copy, and card density all conform to Iron & Ember and the brand's "commanding, engineered" tone. Draft persistence deferred as a follow-on task.  
**Session Type:** Development  
**Status:** PENDING

---

## Issues Inventory

| # | Issue | File | Complexity |
|---|-------|------|------------|
| 1 | ALL-CAPS form labels | `session-template-form.tsx` | Trivial |
| 2 | "New event" button with `border-l-2 border-ember` | `library.tsx` | Trivial |
| 3 | "Add group" styled secondary instead of primary | `session-template-form.tsx` | Trivial |
| 4 | No draft persistence / unsaved-changes guard | `session-template-form.tsx` + new hook | Complex (deferred) |
| 5 | 7 group types flat on one row | `activity-group-editor.tsx` | Moderate |
| 6 | SessionTemplateCard information-sparse | `session-template-card.tsx` + `library.tsx` | Moderate |
| 7 | Sheet title `text-xs text-ember` (12px) | `library.tsx` | Trivial |
| 8 | Copy: "snap them into any program" | `library.tsx` | Trivial |

---

## Approach

### Phase 1 -- Typography & copy (items 1, 7, 8) `trivial`

**File:** `session-template-form.tsx`
- Lines ~265, ~277, ~285: form field labels "CATEGORY", "DESCRIPTION (OPTIONAL)", "SCORING" use `text-xs font-medium uppercase tracking-wider`. Per `feedback-typography-uppercase.md`, ALL-CAPS+tracking is reserved for nav/badges/column-headers. Change to `text-xs font-medium text-warm-ash/60` (drop `uppercase tracking-wider`).

**File:** `library.tsx`
- Locate the Sheet/dialog title for the template builder. It is styled `text-xs text-ember`. Change to `text-sm font-medium text-bone-white` -- title must be the largest element in its region, not a microlabel.
- Locate empty-state copy containing "snap them into any program". Replace with "wire them into any program".

### Phase 2 -- Button hierarchy (items 2, 3) `trivial`

**File:** `library.tsx`
- Find the "New event" button that uses `border-l-2 border-ember`. Replace with a proper primary button: `variant="default"` (or the `bg-forge` primary pattern used elsewhere). Remove the colored side-border decoration.

**File:** `session-template-form.tsx`
- Line ~387: "Add group" button -- `variant="secondary"` → `variant="default"`. This is the primary forward-progression action in the builder; it must read as primary. The Save button in the footer can drop to `variant="ghost"` if needed (it's a terminal action, not a progression action), but leave it as-is unless it creates visual noise.

### Phase 3 -- Group type layout (item 5) `moderate`

**File:** `activity-group-editor.tsx`

Current: 7 `ToggleGroupItem`s in a single flex-wrap row. On mobile at 32px each, they wrap unpredictably.

Fix: Split into two labeled rows by training modality:
- **Strength:** STRAIGHT / SUPERSET / CIRCUIT / COMPLEX  
- **Conditioning:** EMOM / AMRAP / COUPLET

Replace the single flat `ToggleGroup` with two labeled sub-rows (still one controlled `ToggleGroup` so selection remains mutually exclusive):

```tsx
// Restructure GROUP_TYPES constant into two clusters:
const STRENGTH_TYPES = ['STRAIGHT_SETS', 'SUPERSET', 'CIRCUIT', 'COMPLEX']
const CONDITIONING_TYPES = ['EMOM', 'AMRAP', 'COUPLET']
```

Layout:
```
Strength   [STRAIGHT] [SUPERSET] [CIRCUIT] [COMPLEX]
Conditioning  [EMOM] [AMRAP] [COUPLET]
```

Row labels use `text-[10px] uppercase tracking-wider text-warm-ash/40` -- these ARE navigation-style microlabels, so ALL-CAPS is appropriate here.

The ToggleGroup remains a single `type="single"` wrapping both rows so the radio-selection logic is unchanged.

### Phase 4 -- Card density (item 6) `moderate`

**File:** `session-template-card.tsx` + how it is called in `library.tsx`

Current card data: name + category badge + scoring + "N groups / M exercises".

Check `SessionTemplate` type for `updatedAt` / `lastAssigned` fields. Based on existing hooks (`useTouchSessionTemplateLastAssigned` exists), `lastAssigned` is available.

Add to card:
- **Last used:** format as relative date ("3 days ago", "Today") using a lightweight `formatRelative` helper already used elsewhere in the codebase
- **Usage count** (programs referencing this template): requires either a count field on the `SessionTemplate` type or a separate query. If not already available, skip and note as a data-layer follow-up.

Surface these as a second line of metadata in the existing `text-[11px] text-warm-ash/50` style.

### Phase 5 -- Draft persistence (item 4) `deferred`

This is the only complex item. Requires:
1. A `useSessionTemplateDraft` hook (Zustand or localStorage) that auto-saves form state on every change
2. A `beforeunload` / sheet-close guard that warns when unsaved changes exist
3. Draft hydration on sheet re-open

**Deferred to a follow-on task.** The other 7 issues are safe to ship independently. Draft persistence is a larger UX contract that warrants its own plan + commit.

---

## Verification

- [ ] Form field labels render as mixed-case (no uppercase tracking on "Category", "Description (optional)", "Scoring")
- [ ] Sheet title is visually the largest text in its header region
- [ ] Empty state uses "wire them into any program"
- [ ] "New event" button has solid fill, no side-border accent
- [ ] "Add group" button renders as primary (same prominence as other primary CTAs)
- [ ] Group types render in two labeled rows (Strength / Conditioning) on mobile without wrapping chaos
- [ ] SessionTemplateCard shows last-used date (if field available in type)
- [ ] `bun run build` passes with no TypeScript errors
- [ ] `bun run lint` passes

---

## Risks

- **Group type layout:** Splitting into two rows with a wrapping ToggleGroup may break the `ToggleGroup` single-value radio behavior if sub-rows are separate component trees. Keep a single `<ToggleGroup>` wrapping both row containers -- only the visual layout splits, not the selection logic.
- **Card density:** `updatedAt` vs `lastAssigned` semantics differ. Check which field is actually populated and meaningful before surfacing it.
- **"New event" button:** Need to read the exact JSX in `library.tsx` to find the button before editing -- outline search showed it but didn't return that section. Sub-agent should read lines ~79-530 of `library.tsx` to locate it.

---

## Execution

Recommended: `/impl` with a single frontend-specialist sub-agent.

All changes are isolated to 3 files (`session-template-form.tsx`, `activity-group-editor.tsx`, `session-template-card.tsx`) plus `library.tsx`. No backend changes, no schema changes, no new hooks (unless `lastAssigned` needs plumbing).

Commit order:
1. Typography + copy (trivial, standalone)
2. Button hierarchy (trivial, standalone)
3. Group type layout (moderate, isolated to `activity-group-editor.tsx`)
4. Card density (moderate, depends on type availability)
