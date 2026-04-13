# Quick Plan: Address PR #30 Review Findings

**Task:** Fix all critical, important, and actionable suggestion findings from the PR review of `feat/events-packing-list`

**Goal:** Merge-ready code -- all critical bugs fixed, important issues addressed, test gaps closed

---

## Fixes by priority

### Critical (must fix)

**C1 -- Timezone bug in `combineDateTime`**
- File: `src/components/event-builder/event-template-form.tsx`
- Store date-only as `YYYY-MM-DD` (no time component) when time is empty
- When time is provided, append local offset via `getTimezoneOffset()` instead of converting to UTC
- Add tests for `combineDateTime`/`splitDateTime` edge cases

**C2 -- `eventUrl` bypasses Zod validation**
- File: `src/components/event-builder/event-template-form.tsx`
- Validate `eventUrl` in the `validate()` function using `z.url()` check before saving
- Show error in the existing `errors` state array if invalid

### Important (should fix)

**I1 -- Sequential item persistence partial state**
- File: `src/components/event-builder/event-template-form.tsx`
- Switch `createDraftItems` and `reconcileEventItems` loops to `Promise.allSettled`
- Collect failures and report them in `setErrors` instead of failing silently mid-loop

**I2 -- DST-unsafe daysUntil in `useNextUpcomingEvent`**
- File: `src/hooks/use-event-items.ts`
- Compare `YYYY-MM-DD` strings (parse eventDate, get today's date string, compute day difference via date-only arithmetic) instead of millisecond diff

**I3 -- TauriAdapter read/write inconsistency**
- File: `src/lib/tauri-adapter.ts`
- Change `getEventItems` to also throw `"Not implemented in offline mode"` to be consistent with the write stubs

### Suggestions (actionable)

**S1 -- Rust: "0 days" notification edge case**
- File: `src-tauri/src/event_reminder.rs`
- Add special-case in the title builder: `if days_until == 0 { "TODAY" } else { "in N day(s)" }`

**S2 -- Packing list sort_order is category-scoped, but query sorts only by sort_order**
- File: `src/lib/supabase-adapter.ts` (`getEventItems`)
- Add `.order('category', { ascending: true })` before `.order('sort_order')` so query order matches render order

**S4 -- Double hydration in form init (minor)**
- File: `src/components/event-builder/event-template-form.tsx`
- Extract results of `hydrateRequirements` / `hydrateDraftItems` into local `const` before state initializers so they're only called once

### Test coverage (new tests)

- `src/lib/__tests__/data-mapper.test.ts`: `toEventItem` and `fromEventItem` roundtrip
- `src/hooks/__tests__/use-event-items.test.ts`: toggle optimistic rollback, reorder cache update
- `src/components/event-builder/__tests__/event-template-form.test.tsx`: `combineDateTime`/`splitDateTime` DST edge cases, URL validation

---

## Approach

Implement top-down by priority: C1 → C2 → I1 → I2 → I3 → S1 → S2 → S4 → tests.

Each fix is isolated to 1-2 files. No database or API changes needed.

## Verification

- `bun run test` passes (≥48/53, matching baseline)
- `cargo test` passes (57/57)
- `bun run build` passes (zero TS errors)
- `cargo clippy -- -D warnings` passes
- Manual: create event with date only -- verify stored date matches entered date
- Manual: enter invalid URL -- verify error shown, save blocked
- Manual: add 5 items to packing list, verify all saved even if slow network

## Risks

- `combineDateTime` fix changes stored ISO format for users who previously had a time component -- existing events with time set will display correctly if we keep reading both formats
- Parallelising item creates with `Promise.allSettled` is safe since items are independent
- `getEventItems` throwing in TauriAdapter means the event packing list will crash if ever rendered in offline mode -- acceptable since offline event items are deferred (W-8)

## Deferred (not in scope)

- S3: `_templateId` stub in `EventCountdownBadge` -- tracked as TODO in code
- S5: Migration comment formatting -- cosmetic only, migration already applied
- Full component test suite for event-builder -- large scope, belongs in a follow-up
