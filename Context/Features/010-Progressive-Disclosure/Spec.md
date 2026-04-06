# Spec: Builder Progressive Disclosure & Contextual Help

**Feature:** 010-Progressive-Disclosure
**Step:** 14.5
**Priority:** P1
**Status:** Draft
**Dependencies:** Step 10 (session templates + SetScheme editor), Step 12 (program builder DnD UI), Step 1.5 (Iron & Ember design system)
**Estimated effort:** 2.5 days
**Can parallel with:** Steps 14-18

---

## Overview

Add progressive disclosure and contextual help to the template builder and program builder. Fields that are irrelevant to the selected context (session category, group type, set scheme type) are hidden behind expandable rows. Domain-specific terminology is explained via inline help triggers at the point of need.

## Problem Statement

The template builder renders all configuration options simultaneously regardless of context. A user creating a simple strength session sees Scoring dropdowns, Time Cap fields, Cardio set schemes, and Metcon options -- none of which apply. The program builder uses TB-specific vocabulary (Accumulation, Intensification, Realization) with no inline explanation. Both builders are overwhelming even to the app's developer, presenting a flat wall of options where a guided, context-aware flow would serve better.

**Current state:**

- `SessionTemplateForm` renders Scoring, Time Cap, and Rest Between Groups unconditionally for all categories
- `ActivityGroupEditor` immediately expands all fields (type selector, rest/rounds, exercises, set scheme editor) on creation
- `SetSchemeEditor` shows all 12 types across 4 categories regardless of session category
- `LoadSpecEditor` shows all 7 load options regardless of set scheme type (only filtering is `exerciseSupports1RM`)
- Block type selector (`ToggleGroup`) and source selector have no explanatory text
- No help/tooltip/popover component exists in the UI library

## User Stories

1. **As a user creating a Strength session**, I want to see only strength-relevant fields (no Scoring, no Time Cap) so I can focus on what matters for my workout.

2. **As a power user switching categories**, I want my previously entered values preserved when fields become hidden, so I don't lose work if I change my mind.

3. **As a user adding an activity group**, I want to first choose the group type before seeing configuration fields, so I'm not overwhelmed by options that depend on that choice.

4. **As a user selecting a set scheme**, I want to see only the types relevant to my session category by default, with the option to expand to all 12 if needed.

5. **As a new user in the program builder**, I want to understand what Accumulation, Intensification, and Realization mean without leaving the builder or consulting external documentation.

6. **As a user exploring program sources**, I want a brief explanation of each source type so I know which one applies to my situation.

## Requirements

### Must Have (P0)

**R1. HelpTrigger component**

- Reusable component with `help_outline` Material Symbol icon (20px, `text-warm-ash`, `text-ember` on hover)
- Opens Popover on large screens (>=768px), Drawer (shadcn/vaul) on mobile (<768px)
- Props: `title` (string), `content` (ReactNode), `placement` (`'inline'` | `'section'`)
- Popover: `bg-surface-gunmetal`, max-width 360px, `rounded-none`
- Drawer: full-width, `bg-surface-gunmetal`, heat-blur backdrop overlay, swipe-to-dismiss via vaul
- Dismiss: tap outside, tap icon again, swipe down (drawer)

**R2. Template builder: category-aware field visibility**

- When category is Strength: hide Scoring and Time Cap behind a collapsed expandable row
- When category is SE: hide Scoring behind a collapsed expandable row
- When category is Conditioning or Mixed: show all fields
- Collapsed row: `bg-surface-charcoal`, `text-warm-ash` label listing hidden field names, `expand_more`/`expand_less` chevron
- Category change preserves values in hidden fields (never cleared automatically)
- Rest Between Groups always visible for all categories

**R3. Activity group: staged reveal**

- Stage 1: New group shows only group type selector + HelpTrigger for group types
- Stage 2: After type selection, group expands to show type-relevant rest fields + exercise selector
- Group-level field visibility by type:
  - Rest / Rounds: only Circuit
  - Rest / Exercises: Straight, Superset, Circuit, Couplet
  - Rounds (count): only Circuit, Couplet
- Type change resets group-level rest fields but preserves exercises

**R4. Set scheme editor: category-filtered type list**

- Strength sessions default to: FixedSets, PercentageSets, WorkToMax
- Conditioning sessions default to: CardioSteadyState, CardioInterval, RuckMarch, EMOM, AMRAPTimed, DescendingReps
- SE sessions default to: ForReps, TimedHold, PercentageOfMaxReps
- Mixed sessions: all 12 (no filtering)
- "Show all types" ghost button reveals full list; categories with no visible types are omitted
- "Show all types" state persists as local React state on the template builder (not Zustand/localStorage); resets when builder closes and reopens
- Category grouping headers retained when types are shown

**R5. Load type: context-filtered options**

- Filter load options by set scheme type per the visibility table in the feature brief
- Hide load section entirely for: PercentageSets, PercentageOfMaxReps, CardioSteadyState, CardioInterval, RuckMarch

**R6. Program builder: block type inline help**

- HelpTrigger next to block type section label with explanations for all 5 types
- One-line summary below type pills on selection in `text-warm-ash` `font-body` `text-xs`

**R7. Program builder: source badge help**

- HelpTrigger next to source section label with explanations for all 7 source types

### Should Have (P1)

**R8. Typography utility classes**

- Add `text-label-large` and `body-small` utility classes to `src/index.css` mapping to the DESIGN.md type scale (Space Grotesk / Inter with appropriate sizes)

**R9. Popover component**

- Install/add shadcn Popover component (`@radix-ui/react-popover`) to `src/components/ui/popover.tsx`
- Style with Iron & Ember tokens (bg-surface-gunmetal, rounded-none)

### Won't Have (this step)

- Tutorial flows or onboarding wizards
- Tooltips on every field label (only on domain-specific terminology)
- Animated transitions between visibility states (simple show/hide is sufficient)
- Keyboard-driven help navigation
- Persistence of "Show all types" toggle state across builder close/reopen (persists within session only)
- Help content CMS or i18n (static strings in component files)

## Testable Assertions

| ID    | Assertion                                                                               | Requirement |
| ----- | --------------------------------------------------------------------------------------- | ----------- |
| TA-1  | Selecting Strength category collapses Scoring and Time Cap into a single expandable row | R2          |
| TA-2  | Expanding the collapsed row reveals Scoring and Time Cap fields with preserved values   | R2          |
| TA-3  | Switching from Strength to Conditioning shows Scoring and Time Cap without data loss    | R2          |
| TA-4  | Tapping "+ Add group" shows only the group type selector and HelpTrigger                | R3          |
| TA-5  | Selecting Circuit group type reveals Rounds, Rest / Rounds, and Rest / Exercises fields | R3          |
| TA-6  | Selecting Complex group type shows no rest fields (only exercise selector)              | R3          |
| TA-7  | Changing group type from Circuit to Straight preserves exercises but resets rest fields | R3          |
| TA-8  | Strength session shows only FixedSets, PercentageSets, WorkToMax in set scheme selector | R4          |
| TA-9  | Tapping "Show all types" reveals all 12 types with category headers                     | R4          |
| TA-10 | Cardio category headers are omitted when filtering for Strength                         | R4          |
| TA-11 | Selecting PercentageSets hides the load section entirely                                | R5          |
| TA-12 | Selecting FixedSets shows Weight, RPE, BW, BW+, None load options                       | R5          |
| TA-13 | WorkToMax shows only Weight, RPE, None load options                                     | R5          |
| TA-14 | HelpTrigger opens popover on large screens (>=768px viewport)                           | R1          |
| TA-15 | HelpTrigger opens bottom sheet on mobile (<768px viewport)                              | R1          |
| TA-16 | Block type HelpTrigger shows correct explanation for Accumulation                       | R6          |
| TA-17 | Selecting Intensification block type shows one-liner below pills                        | R6          |
| TA-18 | Source HelpTrigger shows correct explanation for each source type                       | R7          |
| TA-19 | Existing template save/load/edit flows work unchanged                                   | R2-R5       |
| TA-20 | All new UI follows Iron & Ember spec (0px radius, correct surfaces, correct fonts)      | R1-R7       |

## Resolved Questions

1. **EVENT category handling** -- Safe to ignore. EVENT sessions use a completely different UI path (event metadata, requirements, packing lists) with none of the activity group / set scheme controls that 14.5b-14.5e filter. EVENT is not shown in the template builder's category selector. No changes needed.

2. **"Show all types" persistence** -- Yes, persist within the editing session, reset on close. Store as local React state on the template builder component (not Zustand, not localStorage). User "graduates" past the guardrail for the current editing session; resets when they close and reopen.

3. **Mobile bottom sheet library** -- Use shadcn's Drawer component (wraps `vaul` internally). Provides swipe-to-dismiss, snap points, and visual handle out of the box. HelpTrigger conditionally renders Drawer on mobile (<768px) and Popover on large screens (>=768px). Install via `bunx --bun shadcn@latest add drawer` if not present.

## Dependencies

### Upstream (required before this step)

- Step 10: Session templates + SetScheme editor (complete)
- Step 12: Program builder DnD UI (complete)
- Step 1.5: Iron & Ember design system (complete)

### Downstream (enabled by this step)

- Steps 14-18: Can proceed in parallel
- Future onboarding flows can build on the HelpTrigger component

### New Dependencies Introduced

- `@radix-ui/react-popover` -- Popover primitive for HelpTrigger on large screens (via shadcn)
- `vaul` -- Drawer primitive for HelpTrigger on mobile (via shadcn Drawer component)
