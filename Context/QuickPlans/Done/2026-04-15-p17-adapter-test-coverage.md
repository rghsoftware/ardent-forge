# P17: Adapter Test Coverage Gaps

**Task:** Close four open test coverage gaps from the PR #107 review
**Goal:** All four P17 items pass; `bun run test` green
**Scope:** Tests only -- no production code changes

---

## Items

| # | File | Change |
|---|------|--------|
| P17-007 | `src/lib/__tests__/adapter-utils.test.ts` (new) | Unit tests for `camelizeKeys` and `parseJsonOrValue` |
| P17-008 | `src/lib/__tests__/supabase-adapter.test.ts` | Malformed-JSON fallback test for `mapScheduledSession` |
| P17-009 | `src/lib/__tests__/supabase-adapter.test.ts` | Fix `sessionTemplateRow` and `templateActivityRow` JSONB fixtures |
| P17-010 | `src/lib/__tests__/supabase-adapter.test.ts` | Add `supports1RM` assertion to `getExercises` happy-path test |

---

## Approach

### P17-007: New `adapter-utils.test.ts`

Create `src/lib/__tests__/adapter-utils.test.ts`. Import `camelizeKeys` and `parseJsonOrValue` from `../adapter-utils`.

**`camelizeKeys` tests:**
- Already-camelCase key passthrough: `{ createdAt: 'x' }` → key unchanged
- Standard snake-to-camel: `{ created_at: 'x' }` → `{ createdAt: 'x' }`
- Multiple underscores: `{ foo_bar_baz: 1 }` → `{ fooBarBaz: 1 }`
- Leading underscore: `{ _private: 'x' }` → key unchanged (no letter before `_`)
- **Digit-adjacent regression:** `{ supports_1rm: true }` → key stays `supports_1rm` (the regex `/_([a-z])/g` does not match `_1`). This test documents the known limitation -- assert the actual (broken) behavior so any future fix is visible.
- Object values pass by reference (nested object is not deep-transformed)

**`parseJsonOrValue` tests:**
- String input parses JSON: `parseJsonOrValue('{"a":1}', 'col')` → `{ a: 1 }`
- Object passthrough: passing a pre-parsed object returns it unchanged
- Malformed JSON throws with column name in the error message: `parseJsonOrValue('{bad}', 'overrides')` throws containing `"overrides"` in message

### P17-009: Fix JSONB fixtures (do this before P17-008)

In `supabase-adapter.test.ts`:

- `sessionTemplateRow.rest_between_groups`: change from `JSON.stringify({ seconds: 120 })` to `{ seconds: 120 }` (pre-parsed object, exercises `parseJsonOrValue`'s object-passthrough branch)
- `templateActivityRow.set_scheme`: change from `JSON.stringify({ type: 'fixedSets', ... })` to the raw object literal

Run `bun run test` after this change to confirm no existing tests break -- the mapper uses `parseJsonOrValue` which handles objects and strings identically at runtime, so behavior is unchanged.

> Note: `SessionTemplateRow` and `ActivityRow` TypeScript types may type JSONB fields as `string`. If they do, use a type cast (`as unknown as SessionTemplateRow`) to keep the test fixture compilable while still exercising the object-passthrough branch.

### P17-008: `mapScheduledSession` malformed-JSON fallback

In `supabase-adapter.test.ts`, inside the scheduled session describe block, add a test:

```typescript
it('falls back to undefined overrides when overrides JSON is malformed', async () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const badRow = { ...scheduledSessionRow, overrides: '{not valid json' }
  mockClient.mockResponse('scheduled_sessions', 'select', [badRow])

  const result = await adapter.getScheduledSessions('bw-001')

  expect(result[0].overrides).toBeUndefined()
  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining('[supabase-adapter]'),
    expect.anything(),
  )
  warnSpy.mockRestore()
})
```

Find the correct adapter method that returns scheduled sessions (likely `getScheduledSessions` or similar -- confirm by grepping for `mapScheduledSession` call sites in `supabase-adapter.ts`).

### P17-010: `supports1RM` assertion

In the existing `getExercises` happy-path test (around line 302), add one assertion after the existing ones:

```typescript
expect(result[0].supports1RM).toBe(true)
```

The fixture `exerciseRow` already has `supports_1rm: true` and `mapExercise` reads it directly via `raw['supports_1rm']` (workaround for the digit-adjacent regex bug), so the value should round-trip correctly.

---

## Verification

```bash
bun run test src/lib/__tests__/adapter-utils.test.ts
bun run test src/lib/__tests__/supabase-adapter.test.ts
bun run test  # full suite green
```

---

## Risks

- `SessionTemplateRow`/`ActivityRow` types may not accept raw objects for JSONB fields -- need a type cast for P17-009
- P17-008 needs the exact adapter method name that calls `mapScheduledSession`; grep for call sites first
- The digit-adjacent test in P17-007 intentionally documents broken behavior -- add a `// known limitation` comment so it's clear this is not a mistake
