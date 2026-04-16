# B009: mapScheduledSession Overrides Happy-Path Tests

**Task:** Add two tests covering the `if (r.overrides != null)` branch in `mapScheduledSession`
**Goal:** Both the string-parse path (Tauri/SQLite) and the object-passthrough path (Supabase PostgREST) have green assertions
**Scope:** Tests only -- no production code changes

---

## Approach

Both tests go inside the existing `getProgramFull` describe block in
`src/lib/__tests__/supabase-adapter.test.ts`, alongside the malformed-JSON test.

### Fixture shape

`sessionOverridesSchema` is:
```typescript
{ activityOverrides?: Record<string, { exerciseId?: string; setScheme?: SetScheme }> }
```

Use a minimal valid override:
```typescript
const overridesObj = { activityOverrides: { 'act-001': { exerciseId: 'ex-002' } } }
```

### Test 1 -- string-parse path (Tauri/SQLite)

```typescript
it('parses overrides when stored as a JSON string (Tauri/SQLite path)', async () => {
  const row = { ...scheduledSessionRow, overrides: JSON.stringify(overridesObj) }
  mockClient.mockResponse('programs', 'select', [programRow])
  mockClient.mockResponse('blocks', 'select', [blockRow])
  mockClient.mockResponse('block_weeks', 'select', [blockWeekRow])
  mockClient.mockResponse('scheduled_sessions', 'select', [row])

  const result = await adapter.getProgramFull('prog-001')

  expect(result!.scheduledSessions[0].overrides).toEqual(overridesObj)
})
```

### Test 2 -- object-passthrough path (Supabase PostgREST)

```typescript
it('passes through overrides when already a parsed object (PostgREST path)', async () => {
  const row = { ...scheduledSessionRow, overrides: overridesObj as unknown as string }
  mockClient.mockResponse('programs', 'select', [programRow])
  mockClient.mockResponse('blocks', 'select', [blockRow])
  mockClient.mockResponse('block_weeks', 'select', [blockWeekRow])
  mockClient.mockResponse('scheduled_sessions', 'select', [row])

  const result = await adapter.getProgramFull('prog-001')

  expect(result!.scheduledSessions[0].overrides).toEqual(overridesObj)
})
```

Define `overridesObj` as a `const` at the top of the describe block (or inline in each test).

---

## Verification

```bash
bun run test src/lib/__tests__/supabase-adapter.test.ts
bun run test  # full suite green
```

---

## Risks

- `ScheduledSessionRow.overrides` is typed as `string | null`. The object-passthrough test
  needs `as unknown as string` cast on the fixture (same pattern as `sessionTemplateRow.rest_between_groups`).
- If `sessionOverridesSchema.parse()` rejects the fixture shape, adjust `overridesObj` to
  match the actual schema.
