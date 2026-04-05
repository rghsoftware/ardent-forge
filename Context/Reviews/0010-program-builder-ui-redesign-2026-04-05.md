# PR Review: worktree-program-builder-ui-exploration -> develop

**Date:** 2026-04-05
**Feature:** Exploratory UI redesign (no feature directory)
**Branch:** worktree-program-builder-ui-exploration
**Reviewers:** code-reviewer, silent-failure-hunter, pr-test-analyzer, comment-analyzer, type-design-analyzer
**Status:** :yellow_circle: Partially resolved

## Summary

5 review agents analyzed 41 files (+1,875 / -1,518 lines) across 4 commits. Build, tests (1,762), and lint all pass. 29 findings total: 22 [FIX] (1 critical, 2 high, 5 medium, 14 low) and 7 [TASK] (1 medium type refactor, 3 medium test gaps, 2 low test gaps, 1 backlog). The decomposition of the 1,080-line `set-scheme-editor.tsx` monolith is well-structured, but error handling gaps in `library.tsx` and a type safety hole in `DurationInput` need fixing before merge.

## Findings

### Fix-Now

#### [FIX] P10-001: DurationInput unsafe type cast enables undefined where Duration expected

- **File:** src/components/session-builder/inputs/duration-input.tsx:55-66
- **Severity:** Critical
- **Detail:** The component uses `(onChange as (d: Duration | undefined) => void)(undefined)` gated on `size === 'compact'`, not on which prop interface was passed. A caller using `DurationInputProps` (non-undefinable onChange) with `size="compact"` will silently receive `undefined`, causing runtime crashes when accessing `.seconds`. Replace the two-interface union with a discriminated `clearable` boolean prop.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Replaced two-interface union with discriminated union on `clearable` prop. When `clearable` is true, `onChange` accepts `Duration | undefined`; otherwise only `Duration`. Removed unsafe `as` cast. Updated all callers (activity-group-editor, session-template-form) to pass `clearable`.

#### [FIX] P10-002: Silent userId guards in library.tsx action handlers

- **File:** src/routes/\_authenticated/library.tsx:378-393
- **Severity:** High
- **Detail:** `handleActivate` and `handleDeactivate` silently `return` when `userId` is falsy. Per `.claude/rules/error-handling.md`, user-action guard clauses must log with `[module-name]` prefix and set user-facing error state. The correct pattern is already used in `builder.tsx:174-177`.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `console.error('[library]')` logging and `toast()` user-facing feedback to both guard clauses.

#### [FIX] P10-003: Catch blocks in library.tsx log but never surface errors to user

- **File:** src/routes/\_authenticated/library.tsx:98-104, 380-405
- **Severity:** High
- **Detail:** Four handlers (template delete, program activate, program deactivate, program delete) catch errors and `console.error` but provide no user-facing feedback (toast, inline error). A failed delete appears to the user as nothing happening. Per error-handling.md, user-action error handlers must set a user-facing error state.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `toast()` calls (via sonner) in all four catch blocks. Kept existing `console.error` logging.

#### [FIX] P10-004: collapsed-fields-row max-height animation clips dynamic content

- **File:** src/components/session-builder/collapsed-fields-row.tsx:19-27
- **Severity:** Medium
- **Detail:** `useEffect` sets `maxHeight` to `scrollHeight` at expansion time, but children (scoring dropdown, DurationInput) can change height afterward. Once set to a fixed pixel value, the container clips content that grows beyond the captured `scrollHeight`. Fix: set `maxHeight` to `'none'` after the transition completes via a `transitionend` listener.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `transitionend` listener that sets `maxHeight` to `'none'` after expansion completes. On collapse, locks to `scrollHeight`, forces reflow, then animates to `0px`.

#### [FIX] P10-005: String.replace only replaces first underscore in modality names

- **File:** src/components/session-builder/inputs/cardio-modality-select.tsx:39
- **Severity:** Low
- **Detail:** `m.replace('_', ' ')` only replaces the first match. Future modalities with multiple underscores would render incorrectly. Use `m.replaceAll('_', ' ')`.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Changed `.replace('_', ' ')` to `.replaceAll('_', ' ')`.

#### [FIX] P10-006: CATEGORY_BADGE duplicates SESSION_TYPE_BADGE from constants

- **File:** src/components/session-builder/session-template-card.tsx:30-36
- **Severity:** Low
- **Detail:** `CATEGORY_BADGE` is an identical copy of `SESSION_TYPE_BADGE` from `program-builder/constants.ts`. Other components import from constants. This should import rather than duplicate.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Removed duplicated `CATEGORY_BADGE`; imported `SESSION_TYPE_BADGE` from `@/components/program-builder/constants`. Updated all references.

#### [FIX] P10-007: handleTypeChange accepts string instead of LoadSpec['type']

- **File:** src/components/session-builder/inputs/load-spec-editor.tsx:49
- **Severity:** Medium
- **Detail:** Per `.claude/rules/typescript-conventions.md`, domain-keyed types must use the union, not `string`. The `default` case silently falls back to `'unspecified'` for any unknown string instead of being caught at compile time.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Changed parameter type from `string` to `LoadSpec['type']`. Added explicit `case 'unspecified'` and `default` branch with `never` exhaustive check + error logging.

#### [FIX] P10-009: Orphaned "Source labels" section comment above wrong constant

- **File:** src/components/program-builder/constants.ts:103
- **Severity:** Low
- **Detail:** After refactoring, the "Source labels for program source badges" comment sits above `BLOCK_TYPE_STYLES`, not `SOURCE_LABELS` (which is 12 lines further down). Move the comment or replace it.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Moved "Source labels" comment to above `SOURCE_LABELS`. Added "Block type visual styles" section comment above `BLOCK_TYPE_STYLES`.

#### [FIX] P10-010: "Category color map" comment is incomplete/inaccurate

- **File:** src/components/session-builder/session-template-card.tsx:27
- **Severity:** Low
- **Detail:** Comment says "Category color map" but now covers `CATEGORY_BADGE` (renamed) and a new `SCORING_LABELS` constant. "color map" also undersells the content (full Tailwind class strings). Update to reflect both constants.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Updated section comment to "Display constants (SESSION_TYPE_BADGE imported from program-builder/constants)".

#### [FIX] P10-011: Number inputs desync visual state from parent on clear

- **File:** src/components/session-builder/inputs/underline-number-input.tsx, distance-input.tsx, weight-input.tsx
- **Severity:** Medium
- **Detail:** When the user deletes all text, `parseFloat("")` returns `NaN`, the guard prevents calling `onChange`, and parent state retains the old value. The input visually shows empty but the form holds stale data. User clears a weight field, sees it empty, saves -- old weight persists.
- **Status:** :white_check_mark: Fixed
- **Resolution:** When parsed value is NaN (empty field), `onChange(0)` is called instead of silently skipping, keeping parent state in sync.

#### [FIX] P10-012: Ladder input allows local text / parent repLadder state divergence

- **File:** src/components/session-builder/scheme-fields/descending-reps-fields.tsx:34-44
- **Severity:** Medium
- **Detail:** Rep ladder parsing only calls `onChange` when >= 2 valid numbers are parsed. If user types a single number, local `ladderText` updates but `onChange` never fires, leaving parent state stale. No validation hint tells the user that >= 2 entries are required.
- **Status:** :white_check_mark: Fixed
- **Resolution:** `onChange` now fires for any number of parsed values (even 0 or 1). Added validation hint "Enter at least 2 numbers separated by commas" when field has content but fewer than 2 valid numbers.

#### [FIX] P10-013: Silent return in handleMoveActivity out-of-bounds guard

- **File:** src/components/session-builder/activity-group-editor.tsx:131
- **Severity:** Low
- **Detail:** `handleMoveActivity` silently returns when target index is out of bounds. UI buttons are disabled at boundaries (low risk), but per error-handling.md convention, should log with `[activity-group-editor]` prefix. Same pattern in `handleMoveGroup` at `session-template-form.tsx:168`.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `console.warn` with module prefixes `[activity-group-editor]` and `[session-template-form]` respectively.

#### [FIX] P10-014: Add explanatory comment for DurationInput compact-mode undefined semantics

- **File:** src/components/session-builder/inputs/duration-input.tsx:53-66
- **Severity:** Low
- **Detail:** The compact variant emits `undefined` when both fields are zero (meaning "no rest specified" vs "exactly 0 seconds"). This is a critical behavioral distinction for downstream persistence with no comment explaining the design decision.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added JSDoc on the `clearable` prop and inline comment in the `emit` function explaining the undefined semantics.

#### [FIX] P10-015: Strengthen LoadSpecEditor useEffect reset comment

- **File:** src/components/session-builder/inputs/load-spec-editor.tsx:79-86
- **Severity:** Low
- **Detail:** Comment explains the "what" but not the "when/why". Should explain that scheme type changes can shrink the allowed load list, and auto-reset prevents saving an invalid scheme+load combination.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Replaced terse comment with: "Scheme type changes can shrink the allowed load list. Auto-reset prevents saving an invalid scheme+load combination."

#### [FIX] P10-016: Document empty-means-everything semantic in CATEGORY_SCHEME_TYPES

- **File:** src/components/session-builder/set-scheme-editor.tsx:128-132
- **Severity:** Low
- **Detail:** `defaultTypes.length === 0` meaning "show all" is an inverted semantic that is a maintenance trap. Mixed and Event categories return empty arrays to indicate "all scheme types allowed" rather than "none." Needs a comment explaining this convention.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added comment: "Empty array means 'all scheme types allowed' -- Mixed and Event return [] to show the full list rather than filtering."

#### [FIX] P10-017: Explain why only restBetweenSets is preserved across type switches

- **File:** src/components/session-builder/set-scheme-editor.tsx:142-157
- **Severity:** Low
- **Detail:** Inline comment says "Preserve rest if available on both old and new" but does not explain the UX rationale: rest is high-friction to re-enter (minutes + seconds), so preserving it avoids punishing users experimenting with scheme types. Load is reset because each scheme type has different default load semantics.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Expanded comment with UX rationale: rest is high-friction to re-enter; load resets because each scheme type has different default load semantics.

#### [FIX] P10-018: Clarify sticky behavior scoping in session-template-form layout comment

- **File:** src/components/session-builder/session-template-form.tsx:272-274
- **Severity:** Low
- **Detail:** Comment says "sticky on large screens" but `lg:sticky` inside a CSS Grid cell is sticky within the grid cell's area, not the viewport. Clarify: "sticky within its grid cell so it remains visible while the user scrolls the activity groups column."
- **Status:** :white_check_mark: Fixed
- **Resolution:** Updated comment to: "Sticky within its grid cell so it remains visible while scrolling the activity groups column."

#### [FIX] P10-019: Add extraction rationale to barrel index.ts files

- **File:** src/components/session-builder/inputs/index.ts, scheme-fields/index.ts
- **Severity:** Low
- **Detail:** The 20 newly extracted component files lack any file-level comment. At minimum the barrel index files should explain: "Extracted from set-scheme-editor.tsx to reduce file size (~1,080 lines) and enable independent testing and reuse."
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added file-level comment to both barrel files: "Extracted from set-scheme-editor.tsx to reduce file size and enable independent testing."

#### [FIX] P10-020: Derive unit arrays from domain types with satisfies

- **File:** src/components/session-builder/inputs/weight-input.tsx, distance-input.tsx, pace-input.tsx, cardio-modality-select.tsx
- **Severity:** Low
- **Detail:** `WEIGHT_UNITS`, `DISTANCE_UNITS`, `PACE_UNITS`, and `CARDIO_MODALITIES` are handwritten arrays that duplicate what the Zod schemas define. Adding `satisfies readonly Weight['unit'][]` (etc.) would catch drift between the component's unit list and the domain type.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `as const satisfies readonly T[]` using domain type unit fields to all four unit arrays.

#### [FIX] P10-021: Remove unnecessary as casts in FixedSetsFields

- **File:** src/components/session-builder/scheme-fields/fixed-sets-fields.tsx:14-23
- **Severity:** Low
- **Detail:** The `typeof value.sets === 'object'` check should narrow automatically in TypeScript. The `as NumberRange` and `as number` casts are unnecessary and could mask future type changes. Let TypeScript's control-flow narrowing work naturally.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Inlined `typeof` checks (removed boolean variables) but kept `as` casts. TypeScript cannot narrow Zod-inferred union properties through property access on intersection types. Casts are guarded by adjacent `typeof` checks for safety.

#### [FIX] P10-022: Narrow SCHEME_GROUP_FOR_TYPE value to derived SchemeGroupLabel union

- **File:** src/components/session-builder/set-scheme-editor.tsx:91
- **Severity:** Low
- **Detail:** `satisfies Record<SetSchemeType, string>` should use a derived `SchemeGroupLabel` type from `SCHEME_GROUPS` on the value side. This prevents typos and is consistent with the project convention of domain-keyed Records.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Narrowed value type from `string` to `(typeof SCHEME_GROUPS)[number]['label']`.

#### [FIX] P10-023: Remove 3 self-evident comments

- **File:** src/components/program-builder/block-editor.tsx:171, src/components/session-builder/set-scheme-editor.tsx:244, set-scheme-editor.tsx:288
- **Severity:** Low
- **Detail:** Three comments add no information beyond what the code already makes obvious: "Block header -- two rows for breathing room" (design motivation belongs in commit message), "Dynamic fields" (straightforward switch rendering), "Validation errors" (self-evident from the error mapping code).
- **Status:** :white_check_mark: Fixed
- **Resolution:** Removed all three self-evident comments.

#### [FIX] P10-024: Add comment to ToggleGroup deselect guard

- **File:** src/components/session-builder/activity-group-editor.tsx:90
- **Severity:** Low
- **Detail:** `if (!value) return` in `handleTypeChange` prevents ToggleGroup deselection but has no comment explaining intent. A one-liner would clarify: "ToggleGroup fires empty string on deselect -- ignore to prevent clearing."
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added comment: "ToggleGroup fires empty string on deselect -- ignore to keep current selection."

### Missing Tasks

#### [TASK] P10-008: Narrow onChange in all 12 scheme-fields to specific variant type

- **File:** src/components/session-builder/scheme-fields/\*.tsx
- **Severity:** Medium
- **Detail:** All 12 scheme-fields components accept `onChange: (s: SetScheme) => void` but internally only produce their specific variant. Narrowing to `onChange: (s: SetScheme & { type: 'fixedSets' }) => void` (etc.) would prevent accidental cross-variant emissions. Requires updating all 12 component interfaces and the parent dispatch in `set-scheme-editor.tsx`.
- **Status:** :arrow_right: Deferred
- **Resolution:** Added to `Context/Backlog/Ideas.md` (P10 Review section)

#### [TASK] P10-025: Add tests for LoadSpecEditor auto-reset and handleTypeChange defaults

- **File:** src/components/session-builder/inputs/load-spec-editor.tsx
- **Severity:** Medium
- **Detail:** The `useEffect` that auto-resets load type when it becomes disallowed (lines 80-86) and the `handleTypeChange` callback with 7 branches producing different defaults are untested. If someone changes the reset condition or alters default values, no test would catch it. The auto-reset is especially risky as it silently mutates user state.
- **Status:** :arrow_right: Deferred
- **Resolution:** Added to `Context/Backlog/Ideas.md` (P10 Review section)

#### [TASK] P10-026: Add tests for DurationInput compact mode undefined emission

- **File:** src/components/session-builder/inputs/duration-input.tsx
- **Severity:** Medium
- **Detail:** The compact mode emits `onChange(undefined)` when both minutes and seconds are zero. The component is currently mocked in `session-template-form.test.tsx`, so the actual logic is never tested. A regression where the undefined emission stops working would cause the form to submit stale duration values instead of clearing them.
- **Status:** :arrow_right: Deferred
- **Resolution:** Added to `Context/Backlog/Ideas.md` (P10 Review section)

#### [TASK] P10-027: Add tests for DescendingRepsFields rep ladder parsing

- **File:** src/components/session-builder/scheme-fields/descending-reps-fields.tsx
- **Severity:** Medium
- **Detail:** Non-trivial parsing: splits comma/whitespace-separated text into numbers, filters NaN and non-positive values, requires >= 2 valid numbers. Existing `set-scheme-editor.test.tsx` only checks the input renders, not parsing behavior. Edge cases (single number rejected, negatives filtered, comma+space splitting) need coverage.
- **Status:** :arrow_right: Deferred
- **Resolution:** Added to `Context/Backlog/Ideas.md` (P10 Review section)

#### [TASK] P10-028: Add tests for SetSchemeEditor category-based type filtering

- **File:** src/components/session-builder/set-scheme-editor.tsx:128-140
- **Severity:** Low
- **Detail:** The `sessionCategory` prop drives filtering of visible scheme types and the "Show all types" toggle. Existing tests render without `sessionCategory`, so the filtering path is never exercised. A STRENGTH session showing CARDIO scheme types (or vice versa) would confuse users.
- **Status:** :arrow_right: Deferred
- **Resolution:** Added to `Context/Backlog/Ideas.md` (P10 Review section)

#### [TASK] P10-029: Add tests for FixedSetsFields range vs scalar branching

- **File:** src/components/session-builder/scheme-fields/fixed-sets-fields.tsx:14-23
- **Severity:** Low
- **Detail:** `typeof value.sets === 'object'` determines whether `NumberRangeInput` or `UnderlineNumberInput` renders. Existing test only verifies the scalar path. If the range path breaks, users editing templates with range-based sets/reps would see the wrong input.
- **Status:** :arrow_right: Deferred
- **Resolution:** Added to `Context/Backlog/Ideas.md` (P10 Review section)

### Architectural Concerns

(none)

### Convention Gaps

(none)

## Resolution Summary

**Resolved at:** 2026-04-05
**Session:** Review resolve for program builder UI redesign

| Category  | Total  | Fixed  | Tasks | ADRs | Rules | Deferred | Discarded |
| --------- | ------ | ------ | ----- | ---- | ----- | -------- | --------- |
| [FIX]     | 23     | 23     | --    | --   | --    | --       | --        |
| [TASK]    | 6      | --     | --    | --   | --    | 6        | --        |
| **Total** | **29** | **23** | --    | --   | --    | **6**    | --        |

## Resolution Checklist

- [x] All [FIX] findings resolved
- [x] All [TASK] findings added to backlog (no Steps.md for exploratory branch)
- [x] All [ADR] findings have ADRs created or dismissed
- [x] All [RULE] findings applied or dismissed
- [x] Review verified by review-verify agent
