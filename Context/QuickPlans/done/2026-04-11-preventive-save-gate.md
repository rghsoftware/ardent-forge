# Preventive Save Gate

**Task:** Replace submit-then-shame with a disabled save button once errors are visible, preventing
repeated futile taps once the user already knows the form is incomplete.

**Goal:** Errors stay preventive after first exposure -- the save button locks until the form is
valid, with the button label (not a tooltip) explaining why. Works for touch/gym-floor use.

---

## Design Decision: Hybrid, Not Pure-Preventive

A "disable from first render" approach has a fatal flaw: the button is grey with no visible reason
why. On a complex multi-group form, the user can't see all fields at once, so a disabled button
with no context creates confusion.

The current `hasAttemptedSave` gate already solves discovery: no errors shown until first tap.
The gap is that after errors are surfaced, the save button stays clickable, causing a futile
second tap (scroll-to-error, nothing saved, repeat).

**Recommended model:**

| Phase | Save button | Error summary |
|---|---|---|
| Pre-attempt | Enabled ("Save template") | Hidden |
| Post-attempt, still invalid | **Disabled** ("Resolve issues above") | Visible + clickable |
| Post-attempt, all fixed | Enabled ("Save template") | Hidden |

This preserves discoverability while locking the form once the user knows what's wrong.

**Why button label, not tooltip:**
- No `Tooltip` component exists in `src/components/ui/`
- Touch users (gym floor, gloves) can't hover -- tooltip is dead UX on mobile
- "Resolve issues above" is self-explanatory and points to the clickable summary already rendered

---

## Approach

Single file change: `src/components/session-builder/session-template-form.tsx`

### 1. Derive `isFormValid`

Already computable from existing `errors` useMemo -- no new state needed:

```tsx
const isFormValid = !hasValidationErrors(errors)
```

### 2. Update `disabled` and button label on Save

```tsx
<Button
  type="button"
  variant="molten"
  onClick={handleSave}
  disabled={isSaving || (hasAttemptedSave && !isFormValid)}
  className="min-h-12 flex-1 text-xs"
>
  {isSaving
    ? 'Saving...'
    : hasAttemptedSave && !isFormValid
      ? 'Resolve issues above'
      : 'Save template'}
</Button>
```

### 3. No other changes required

- `handleSave` keeps `setHasAttemptedSave(true)` as a safety net (defensive; button click
  is blocked, but direct keyboard / programmatic calls would still guard correctly)
- Error summary, scroll-to-error, and inline validation all stay as-is
- `serverError` path unaffected (server errors are post-valid-form failures)

---

## What This Does NOT Change

- Pre-attempt UX: form still starts clean, no errors on load
- Inline errors: still gated by `hasAttemptedSave` / `nameTouched`
- Clickable error summary: unchanged, still the primary navigation tool
- Scroll-to-first-error on first failed attempt: still fires

---

## Verification

1. Fresh form: Save button enabled, no errors shown
2. Click Save with empty name + no groups: errors surface, button changes to "Resolve issues above" and is disabled
3. Click an error summary item: scrolls and focuses the field
4. Fill in name: `errors.name` clears, but button stays disabled while other errors remain
5. Complete all groups and activities: `isFormValid` becomes true, button re-enables to "Save template"
6. Successful save: no regressions in happy path

---

## Risks

- **Accidental over-lock:** If `computeErrors` has a false-positive (e.g., an edge case where
  a valid group is marked invalid), the button will be stuck disabled. Mitigate: existing Vitest
  tests for `computeErrors` should cover the primary paths.
- **Copy register:** "Resolve issues above" assumes the error summary is visible above the button.
  Confirm the summary renders before the button row in the DOM (it does -- `summaryItems` block
  appears before the button row at lines 607-630).
