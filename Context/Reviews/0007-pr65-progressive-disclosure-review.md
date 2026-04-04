# PR Review: worktree-feat+progressive-disclosure -> develop

**Date:** 2026-04-04
**Feature:** Context/Features/010-Progressive-Disclosure/
**Branch:** worktree-feat+progressive-disclosure
**PR:** #65
**Reviewers:** code-reviewer, silent-failure-hunter, type-design-analyzer, comment-analyzer, code-simplifier
**Build:** TypeScript PASS, ESLint PASS (no new issues)
**Status:** 🟡 Partially resolved

## Summary

22 files changed across progressive disclosure and contextual help feature. Architecture is sound with data-driven visibility maps and centralized help content. 15 findings total: 7 fix-now, 4 missing tasks, 1 architectural concern, 3 convention gaps. Two critical items: silent save failure and JSX triplication.

## Findings

### Fix-Now

#### [FIX] P7-001: `handleSave` silently no-ops when userId is empty

- **File:** src/components/session-builder/session-template-form.tsx:192
- **Severity:** Critical
- **Detail:** `if (!userId) return` exits without any user feedback. If auth state is lost or not yet loaded, user taps Save and nothing happens -- no error, no spinner, no indication. Should surface an error message via `setErrors()` and log with `[session-template-form]` prefix.
- **Status:** ✅ Fixed
- **Resolution:** Added console.error log with [session-template-form] prefix and setErrors() call for user-facing feedback

#### [FIX] P7-002: Scoring/TimeCap JSX tripled across ternary branches

- **File:** src/components/session-builder/session-template-form.tsx:312-406
- **Severity:** Critical
- **Detail:** The Scoring `<Select>` and TimeCap `<DurationInputCompact>` are copy-pasted three times across three ternary branches. Any change to scoring options or styling must be replicated in three places. Extract to local variables and conditionally wrap in `CollapsedFieldsRow`.
- **Status:** ✅ Fixed
- **Resolution:** Extracted scoringField and timeCapField to local variables; single CollapsedFieldsRow wraps hidden fields dynamically

#### [FIX] P7-003: Redundant `satisfies` after explicit type annotation in visibility maps

- **File:** src/components/builders/visibility-maps.ts (all 4 exports)
- **Severity:** Medium
- **Detail:** All four constants have both an explicit `Record<...>` type annotation and a trailing `satisfies Record<...>` with the identical type. The `satisfies` is redundant when the annotation matches. Keep only `satisfies` to get narrower literal type inference (e.g., `false` instead of `boolean`), or keep only the annotation -- but not both.
- **Status:** ✅ Fixed
- **Resolution:** Removed explicit type annotations, kept only satisfies on all 4 exports

#### [FIX] P7-004: Unstable `availableTypes` in useEffect dependency array

- **File:** src/components/session-builder/set-scheme-editor.tsx:506-512
- **Severity:** Medium
- **Detail:** `availableTypes` is created via `.filter()` on every render, making it a new reference each time. Including it in the `useEffect` deps means the effect runs every render (guarded by `!isCurrentAllowed` check, so no infinite loop, but wasteful). Simplify to derive `isCurrentAllowed` directly from `allowedLoads` and `value.type` inside the effect.
- **Status:** ✅ Fixed
- **Resolution:** Derived isCurrentAllowed from stable allowedLoads and value.type inside the effect; removed availableTypes from deps

#### [FIX] P7-005: Identical block type help content JSX in two files

- **File:** src/components/program-builder/block-editor.tsx, src/components/program-builder/mobile-block-editor.tsx
- **Severity:** Medium
- **Detail:** Both files contain an identical ~25-line block of JSX: "Block type" label + `HelpTrigger` with `BLOCK_TYPE_HELP` content rendering + `ToggleGroup` + one-liner description. Extract the help content JSX into a shared constant or small component in `builders/`.
- **Status:** ✅ Fixed
- **Resolution:** Extracted BlockTypeSelector component to program-builder/block-type-selector.tsx; both editors now import it

#### [FIX] P7-006: Add branch comments to Scoring/TimeCap ternary

- **File:** src/components/session-builder/session-template-form.tsx:312,342
- **Severity:** Low
- **Detail:** The third branch (line 374) has a helpful comment `{/* showScoring is false, showTimeCap is true (SE category) */}` but the first two branches lack equivalent comments. Add `{/* Both visible: Conditioning, Mixed */}` and `{/* Both hidden: Strength, Event */}` for consistency.
- **Status:** ❌ Discarded
- **Resolution:** P7-002 eliminates the ternary -- extraction removes the three-branch structure entirely

#### [FIX] P7-007: Add JSDoc to `useMediaQuery` and `HelpTrigger`

- **File:** src/hooks/use-media-query.ts, src/components/ui/help-trigger.tsx
- **Severity:** Low
- **Detail:** `useMediaQuery` has no comments -- worth explaining why `useSyncExternalStore` over `useState+useEffect` (avoids tearing in concurrent mode) and why `getServerSnapshot` returns `false`. `HelpTrigger` should note the Popover-on-desktop/Drawer-on-mobile strategy and that the spec's `placement` prop was intentionally omitted.
- **Status:** ✅ Fixed
- **Resolution:** Added JSDoc to both useMediaQuery (useSyncExternalStore rationale) and HelpTrigger (responsive strategy, placement omission)

### Missing Tasks

#### [TASK] P7-008: Extract `HelpEntry` interface in help-content.ts

- **File:** src/components/builders/help-content.ts
- **Severity:** Medium
- **Detail:** The `{ label: string; description: string }` shape is duplicated across `GROUP_TYPE_HELP` and `SOURCE_HELP`. Extract into a named `HelpEntry` interface and extend it for `BlockTypeHelpEntry` (which adds `oneLiner`). Reduces duplication and gives a clear name to the concept.
- **Status:** ✅ Fixed
- **Resolution:** Extracted HelpEntry and BlockTypeHelpEntry interfaces; both exported and used in satisfies clauses

#### [TASK] P7-009: Use non-empty tuple for CollapsedFieldsRow labels

- **File:** src/components/session-builder/collapsed-fields-row.tsx
- **Severity:** Medium
- **Detail:** `labels: string[]` permits an empty array, which would render a collapsed row with no visible label text. Use `labels: [string, ...string[]]` to enforce at least one label at compile time.
- **Status:** ✅ Fixed
- **Resolution:** Changed labels type to [string, ...string[]]

#### [TASK] P7-010: Tighten `SCHEME_GROUP_FOR_TYPE` and `SCHEME_TYPE_LABELS` typing

- **File:** src/components/session-builder/set-scheme-editor.tsx:1164,1167
- **Severity:** Medium
- **Detail:** Both maps are typed as `Record<string, string>` with `??` fallbacks. If a new `SetScheme` variant is added to the Zod union, the label silently falls back to `'STRENGTH'` for group name and raw type string for label. Type as `Record<SetSchemeType, string>` with `satisfies` for compile-time exhaustiveness, matching the pattern in `visibility-maps.ts`.
- **Status:** ✅ Fixed
- **Resolution:** Typed as Record<SetSchemeType, string> via Object.fromEntries + as assertion; removed ?? fallbacks

#### [TASK] P7-011: Tighten `BLOCK_TYPE_STYLES` and `SESSION_TYPE_BADGE` typing

- **File:** src/components/program-builder/constants.ts:98-116
- **Severity:** Medium
- **Detail:** Both use `Record<string, string>` instead of `Record<BlockType, string>` and `Record<SessionType, string>`. New domain variants would silently fall back to generic gray styling. Pre-existing issue but amplified by this PR's heavier reliance on these maps.
- **Status:** ✅ Fixed
- **Resolution:** Changed to satisfies Record<BlockType, string> and satisfies Record<SessionType, string>

### Architectural Concerns

#### [ADR] P7-012: No ErrorBoundary in the application

- **File:** App-wide (no `ErrorBoundary` component exists in `src/`)
- **Severity:** High
- **Detail:** This PR adds new Popover/Drawer subtrees via `HelpTrigger` and complex conditional rendering in builders. If any Radix/vaul component throws during render, the entire form crashes and the user loses all unsaved state. At minimum, `HelpTrigger` internals should be wrapped so a failure degrades to a hidden help icon. Ideally, each `ActivityGroupEditor` and `BlockEditor` also gets a boundary so a single group/block error does not destroy the whole form. This is app-wide scope and warrants a decision on error boundary strategy.
- **Relates to:** General app resilience, not specific to a spec assertion
- **Status:** 📋 Deferred
- **Resolution:** Added to Context/Backlog/error-boundary-strategy.md

### Convention Gaps

#### [RULE] P7-013: Visibility/content maps should use `satisfies` without redundant annotation

- **Files:** src/components/builders/visibility-maps.ts, src/components/builders/help-content.ts
- **Severity:** Low
- **Detail:** Pattern appeared 4 times in visibility-maps.ts. When a constant needs compile-time exhaustiveness checking on a Record type, use `satisfies Record<K, V>` alone (not both annotation and satisfies). The `satisfies` provides exhaustiveness while letting TS infer narrower literal types.
- **Suggested rule:** Add to `.claude/rules/` a TypeScript conventions rule: "For exhaustive Record constants, use `satisfies Record<K, V>` without an explicit type annotation to get both safety and narrow inference."
- **Status:** ✅ Rule updated
- **Resolution:** Added to .claude/rules/typescript-conventions.md

#### [RULE] P7-014: Domain-keyed style/label maps must use domain union types, not `string`

- **Files:** src/components/program-builder/constants.ts, src/components/session-builder/set-scheme-editor.tsx
- **Severity:** Medium
- **Detail:** Four maps use `Record<string, string>` for domain-keyed lookups (`BLOCK_TYPE_STYLES`, `SESSION_TYPE_BADGE`, `SCHEME_GROUP_FOR_TYPE`, `SCHEME_TYPE_LABELS`). This defeats compile-time exhaustiveness checking. Any `Record` keyed by a domain union (`BlockType`, `SessionType`, `SetSchemeType`) should use the union type as key.
- **Suggested rule:** Add to `.claude/rules/`: "All Record types keyed by domain union types (SessionType, BlockType, GroupType, SetSchemeType, etc.) must use the union as the key type, not `string`. Use `satisfies` for exhaustiveness."
- **Status:** ✅ Rule updated
- **Resolution:** Added to .claude/rules/typescript-conventions.md

#### [RULE] P7-015: Bare `if (!userId) return` guards must surface user feedback

- **Files:** src/components/session-builder/session-template-form.tsx:192
- **Severity:** Medium
- **Detail:** Silent auth guards that exit save/submit handlers without feedback are a recurring risk pattern. Any guard clause that prevents a user-initiated action (save, delete, submit) must log with `[module-name]` prefix and surface a user-facing error or toast.
- **Suggested rule:** Add to `.claude/rules/error-handling.md`: "Guard clauses in user-action handlers (save, delete, submit) must never silently return. Always log with `[module-name]` prefix and set a user-facing error state."
- **Status:** ✅ Rule updated
- **Resolution:** Added to .claude/rules/error-handling.md

## Resolution Checklist

- [x] All [FIX] findings resolved
- [x] All [TASK] findings resolved (fixed inline -- no Steps.md tasks needed)
- [x] All [ADR] findings deferred to backlog
- [x] All [RULE] findings applied
- [ ] Review verified by review-verify agent

## Resolution Summary

**Resolved at:** 2026-04-04
**Session:** Review resolution for PR #65 progressive disclosure

| Category  | Total  | Fixed  | Tasks | ADRs  | Rules | Deferred | Discarded |
| --------- | ------ | ------ | ----- | ----- | ----- | -------- | --------- |
| [FIX]     | 7      | 6      | --    | --    | --    | --       | 1         |
| [TASK]    | 4      | 4      | --    | --    | --    | --       | --        |
| [ADR]     | 1      | --     | --    | --    | --    | 1        | --        |
| [RULE]    | 3      | --     | --    | --    | 3     | --       | --        |
| **Total** | **15** | **10** | **0** | **0** | **3** | **1**    | **1**     |
