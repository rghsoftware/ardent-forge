# Quick Plan: P10-025 through P10-029 -- Session Builder Test Coverage

**Date:** 2026-04-05
**Source:** Context/Backlog/Ideas.md (P10-025 through P10-029)

## Task

Add unit tests for 5 session builder components covering specific untested logic branches identified in the P10 review.

## Goal

Close the test coverage gaps for load-spec-editor, duration-input, descending-reps-fields, set-scheme-editor, and fixed-sets-fields.

## Approach

5 independent test files, one per component. All follow existing Vitest + Testing Library + happy-dom patterns.

---

### S001: P10-025 -- load-spec-editor tests

**File:** `src/components/session-builder/inputs/__tests__/load-spec-editor.test.tsx`
**Component:** `src/components/session-builder/inputs/load-spec-editor.tsx`

Test cases:

1. useEffect auto-reset: when schemeType changes and current load type is no longer allowed, onChange fires with `unspecified`
2. useEffect no-op: when schemeType changes but current load type is still allowed, no reset
3. useEffect early return: when allowedLoads is null (scheme manages load), no reset
4. handleTypeChange: switching to each of the 7 load types initializes correct defaults (absolute, percentageOf1RM, rpe, bodyweight, bodyweightPlus, percentMaxReps, unspecified)
5. percentageOf1RM filtered out when exerciseSupports1RM is false
6. Component returns null when allowedLoads is null

---

### S002: P10-026 -- duration-input tests

**File:** `src/components/session-builder/inputs/__tests__/duration-input.test.tsx`
**Component:** `src/components/session-builder/inputs/duration-input.tsx`

Test cases:

1. Compact mode renders "M"/"S" labels, default mode renders "MIN"/"SEC"
2. Non-clearable: setting both fields to 0 emits `{ seconds: 0 }`
3. Clearable: setting both fields to 0 emits `undefined`
4. Clearable: non-zero value emits Duration (not undefined)
5. Empty/invalid input defaults to 0 seconds
6. Minutes conversion: entering 2 in minutes field emits 120 seconds (plus existing seconds)

---

### S003: P10-027 -- descending-reps-fields tests

**File:** `src/components/session-builder/scheme-fields/__tests__/descending-reps-fields.test.tsx`
**Component:** `src/components/session-builder/scheme-fields/descending-reps-fields.tsx`

Test cases:

1. Valid comma-separated input: "10, 8, 6" parses to [10, 8, 6]
2. Space-separated input: "10 8 6" parses to [10, 8, 6]
3. Mixed separators: "10, 8 6,4" parses to [10, 8, 6, 4]
4. Single number rejected: warning shown "Enter at least 2 numbers"
5. Negative numbers filtered out
6. Empty input: no warning shown, emits empty array
7. External value sync: when value.repLadder changes, ladderText updates

---

### S004: P10-028 -- set-scheme-editor tests (additions)

**File:** `src/components/session-builder/__tests__/set-scheme-editor.test.tsx` (extend existing)
**Component:** `src/components/session-builder/set-scheme-editor.tsx`

Test cases to ADD (file already has ~60% coverage):

1. sessionCategory filtering: passing sessionCategory restricts visible scheme types to CATEGORY_SCHEME_TYPES[category]
2. Empty category array (e.g., "Mixed") shows all types (categoryShowsAll)
3. "Show all types" toggle renders when filtering is active, not when category allows all
4. Clicking "Show all types" shows all scheme types regardless of category
5. handleTypeChange preserves restBetweenSets when both old and new scheme have the field

---

### S005: P10-029 -- fixed-sets-fields tests

**File:** `src/components/session-builder/scheme-fields/__tests__/fixed-sets-fields.test.tsx`
**Component:** `src/components/session-builder/scheme-fields/fixed-sets-fields.tsx`

Test cases:

1. Scalar sets: renders UnderlineNumberInput for number value
2. Range sets: renders NumberRangeInput for { min, max } value
3. Scalar reps: same pattern as sets
4. Range reps: same pattern as reps
5. "More options" collapsible defaultOpen when restBetweenSets or lastSetAMRAP is set
6. "More options" collapsible defaultClosed when both are empty/undefined
7. AMRAP checkbox toggles lastSetAMRAP

## Verification

- `bun run test` -- all new tests pass
- `bun run build` -- no type errors introduced

## Risks

- Test rendering may need provider wrappers if components use context (check existing patterns)
- Some components may need mocking of child components (e.g., LoadSpecEditor inside set-scheme-editor)
- The set-scheme-editor test file already exists -- extend it, do not replace
