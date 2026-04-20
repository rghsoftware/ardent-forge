You are a test specialist working on the Ardent Forge fitness app (React/TypeScript/Vite, Supabase backend).

## YOUR TASKS: P17-009, P17-010, P17-008

All three changes are to: `src/lib/__tests__/supabase-adapter.test.ts`

Do them in this order: P17-009 first, then P17-010, then P17-008.

---

## Before writing, read these files:
1. `src/lib/__tests__/supabase-adapter.test.ts` — full file (it's ~2024 lines; read in chunks)
2. `src/lib/supabase-adapter.ts` lines 481-515 — the `mapScheduledSession` method
3. `src/lib/database.types.ts` — find `SessionTemplateRow` and `ActivityRow` type definitions to understand JSONB field types

---

## P17-009: Fix JSONB fixtures to use pre-parsed objects

Currently `sessionTemplateRow` (around line 158) and `templateActivityRow` (around line 186) use `JSON.stringify(...)` for their JSONB fields. Change them to pass pre-parsed objects instead — this exercises the object-passthrough branch of `parseJsonOrValue`.

**sessionTemplateRow**: Change `rest_between_groups: JSON.stringify({ seconds: 120 })` → `rest_between_groups: { seconds: 120 }`

**templateActivityRow**: Change `set_scheme: JSON.stringify({ type: 'fixedSets', sets: 3, reps: 5, load: { type: 'absolute', weight: { value: 135, unit: 'lb' } } })` → the raw object literal

**Important**: If `SessionTemplateRow` or `ActivityRow` type these fields as `string`, you'll need a type cast to keep TypeScript happy. Use `as unknown as SessionTemplateRow` or cast the specific field. Check the actual types before deciding.

After this change, run `bun run test src/lib/__tests__/supabase-adapter.test.ts` to confirm no existing tests broke.

---

## P17-010: Add supports1RM assertion to getExercises happy-path test

In the `getExercises` describe block, find the test `'returns mapped exercises with no filters'` (around line 299). Add this assertion after the existing ones:

```typescript
expect(result[0].supports1RM).toBe(true)
```

The fixture `exerciseRow` already has `supports_1rm: true`. The mapper in `supabase-adapter.ts` reads it via `raw['supports_1rm']` directly (workaround for the digit-adjacent regex bug), so the value round-trips correctly.

---

## P17-008: Add mapScheduledSession malformed-JSON fallback test

First, find which public adapter method calls `mapScheduledSession`. Search `supabase-adapter.ts` for `mapScheduledSession` call sites — it should be something like `getScheduledSessions` or similar. Confirm the method name and how it's called before writing the test.

Then, in `supabase-adapter.test.ts`, find the scheduled sessions describe block and add a test:

```typescript
it('falls back to undefined overrides when overrides JSON is malformed', async () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const badRow = { ...scheduledSessionRow, overrides: '{not valid json' }
  // mock the response using the same pattern as other scheduled session tests
  // [find how the mock client is set up for scheduled session queries in nearby tests]

  // call the adapter method that invokes mapScheduledSession
  const result = await adapter.[methodName](/* same args as happy-path test */)

  expect(result[0].overrides).toBeUndefined()
  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining('[supabase-adapter]'),
    expect.anything(),
  )
  warnSpy.mockRestore()
})
```

Fill in `[methodName]` and mock setup by looking at the nearest happy-path test for scheduled sessions in the file.

---

## Completion

Run: `bun run test src/lib/__tests__/supabase-adapter.test.ts`

All tests must pass (including pre-existing ones). Fix any issues before finishing.

Then log: `bun run .claude/hooks/event-log/event-log.ts append --source p17-supabase-agent --type task_done --task P17-009-010-008`
