# Tests from the Backlog

**Task:** Write the tests that are tracked in the backlog (explicit items + coverage gaps surfaced by jcodemunch)
**Date:** 2026-04-14
**Branch:** chore+tests
**Status:** Part A complete

---

## Goal

Close the open test debt on the `chore+tests` branch. Two categories:

1. **Explicit backlog test item** -- E2E display broadcast round-trip (`e2e-display-broadcast-roundtrip.md`)
2. **Unit test coverage gaps** -- functions with confidence-1.0 `unreached` classification from jcodemunch scan

The E2E test is a multi-hour build-out (requires local Supabase, dual browser contexts, auth fixtures). The unit gaps are tractable in a single session.

---

## Scope

### Part A -- Unit Test Coverage Gaps (this session)

These are all `unreached` at confidence 1.0 -- no test file imports or calls them:

| File                                                     | Functions                                                                                   | Notes                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/components/program-builder/session-detail-utils.ts` | `formatSetsReps`, `formatLoad`, `formatLoadSpec`, `formatSeconds`, `buildGroupedActivities` | Pure formatting/transformation functions -- high-value, easy to test |
| `src/domain/types/set-scheme.ts`                         | `parseSetScheme`                                                                            | Domain parser -- complement existing `set-scheme.test.ts`            |
| `src/components/program-builder/builder-state.ts`        | `buildSessionsPayload`, `buildCreateBlocksPayload`, `buildUpdateBlocksPayload`              | Payload builders used at save time                                   |

Lower-priority gaps (chat/connections/analytics hooks are all unreached but complex to mock; defer unless time allows):

- `src/hooks/use-chat.ts` (11 hooks)
- `src/hooks/use-connections.ts` (7 hooks)
- `src/hooks/use-activity-feed.ts`, `use-analytics.ts`, `use-event-items.ts`

### Part B -- E2E Display Broadcast Round-Trip (future session)

Fully spec'd in `Context/Backlog/e2e-display-broadcast-roundtrip.md`. Requires:

- `supabase start` in Playwright webServer config
- Seeded test user + gym via SQL fixture
- `e2e/fixtures/` auth storage state
- `e2e/display-roundtrip.spec.ts` with two browser contexts
- Separate CI job (slow local Supabase startup)

**Not in scope for this session.**

---

## Approach

### Part A Execution Order

1. **`session-detail-utils.test.ts`** -- create `src/components/program-builder/__tests__/session-detail-utils.test.ts`. All five functions are pure (no adapter, no hooks) -- use representative inputs from the existing `set-scheme` and `session` domain types.

2. **`parseSetScheme` in `set-scheme.test.ts`** -- append cases to existing `src/domain/types/__tests__/set-scheme.test.ts`. Check what `parseSetScheme` does vs. the existing schema tests to avoid duplication.

3. **Builder payload tests** -- append to or create alongside `src/components/program-builder/__tests__/builder-state.test.ts`. The existing test file covers `weeksMatch`; add payload-builder cases. Use factories from `src/test/factories.ts`.

Run `bun run test` after each file to confirm green.

---

## Verification

- `bun run test` passes with 0 failures
- jcodemunch `get_untested_symbols` re-run shows the targeted functions are no longer `unreached`
- No new TypeScript errors (`bun run build`)

---

## Risks

- `buildGroupedActivities` and `useSessionTemplatesFull` in session-detail-utils.ts call hooks -- `useSessionTemplatesFull` may need `renderHook` + mock adapter; `buildGroupedActivities` may be pure. Read the file before writing tests.
- The three builder-state payload functions may depend on complex draft state shapes -- use existing factory patterns to construct inputs rather than hand-rolling fixtures.
- `parseSetScheme` may duplicate what `setSchemeSchema.parse` already tests -- read the implementation first and only test genuinely distinct behavior.
