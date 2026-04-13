# Quick Plan: Remove DataMapper Layer

**Task:** Eliminate `data-mapper.ts` (1,097 LOC) by enabling Supabase JS built-in camelCase transformation and inlining non-trivial mappings into the adapters directly.

**Branch:** `chore/camelcase-conv` (already in progress)

---

## Goal

Reduce adapter infrastructure surface area by ~1,100+ LOC. New domain entities should touch at most 2 files (adapter + domain type), not 4+. The `to*` read-path mappers that do mechanical snake_case -> camelCase renaming become redundant once the client handles it.

---

## Approach

### Step 1 -- Verify Supabase JS camelCase API

Before touching code, confirm the exact client option. The Supabase JS v2 client passes through to `@supabase/postgrest-js`. Look for:

```ts
// Option A: db-level transform (postgrest-js >= 1.16 / supabase-js >= 2.x)
createClient(url, key, {
  db: { schema: 'public' },
  global: {
    fetch: /* ... */,
  },
})
```

Check `bun.lockb` / `package.json` for `@supabase/supabase-js` version, then verify against its changelog or source whether `transform: { camelize: true }` or a `fetchOptions` flag exists.

**If the flag does not exist in the installed version:** either upgrade `@supabase/supabase-js` to the version that ships it, or evaluate `postgrest-js`'s `camelize` option directly. Do not proceed until this is confirmed -- the entire approach depends on it.

### Step 2 -- Audit mapper functions (classify before deleting)

Read `data-mapper.ts` and tag each function as one of:

| Class | Description | Action |
|---|---|---|
| **A -- Pure rename** | Only snake_case -> camelCase field renames, no logic | Delete after enabling client transform |
| **B -- Non-trivial read** | JSON parsing, type coercion, computed fields, nested mapping | Inline into `supabase-adapter.ts` at the call site |
| **C -- Write path** | `from*` mappers: camelCase domain -> snake_case DB row | Keep, inline into adapter (client camelCase flag does not affect writes) |
| **D -- Shared utility** | `parseJsonOrValue`, helpers used by multiple mappers | Inline or move to a small `adapter-utils.ts` |

The preview shows 54 functions: `parseJsonOrValue`, `toExercise`, `fromExercise`, `toWorkoutLog`, `fromWorkoutLog`, `toLoggedActivityGroup`, and ~49 more. Expect ~60% to be Class A (eliminate), ~20% Class B (inline), ~20% Class C (write-path, inline).

### Step 3 -- Enable camelCase on Supabase client

Locate `createClient` call (likely `src/lib/supabase.ts` or similar). Add the camelCase flag once confirmed from Step 1.

Update `ExerciseRow`, `WorkoutLogRow`, etc. row types if they will now be returned camelCased by the client -- or remove them entirely if the domain types are used directly after this change.

### Step 4 -- Delete Class A mappers; inline B and C

For each Class A `to*` function:
- Find all call sites in `supabase-adapter.ts` via search
- Remove the mapper call (client now returns camelCase directly)
- Remove the function from `data-mapper.ts`

For each Class B `to*` function:
- Move the non-trivial logic inline to the adapter call site or a private helper in the adapter file
- Remove from `data-mapper.ts`

For each Class C `from*` function:
- Move inline to the adapter write method (insert/upsert)
- Remove from `data-mapper.ts`

### Step 5 -- Handle TauriAdapter

`src/lib/tauri-adapter.ts` (2,717 LOC) also uses mapper functions but calls SQLite via Tauri commands, not the Supabase JS client. The camelCase flag does not help here. Two options:

- **Option A (preferred):** Inline all tauri-side mappings directly into the adapter. Same classification (A/B/C) applies but all classes must be inlined (no client magic).
- **Option B (deferred):** Leave Tauri mappings in a reduced `tauri-mapper.ts` if the volume is large enough to warrant it. Acceptable as a follow-up.

Decide per volume -- if tauri adapter uses >20 mapper functions, Option B is reasonable.

### Step 6 -- Check sharing mappers

The description mentions `sharing-mappers.ts` and `share-rpc-mapper.ts`. Search confirms these do not currently exist on this branch. If added in future, apply the same classification at the time of creation -- do not reintroduce a separate mapper layer.

### Step 7 -- Delete `data-mapper.ts`

Once all functions are migrated, confirm `data-mapper.ts` has zero imports via:
```bash
bun run build
```

Then delete it. Run tests.

---

## Verification

- [ ] `bun run build` passes with no TS errors
- [ ] `bun run test` passes
- [ ] `src/lib/data-mapper.ts` no longer exists
- [ ] No import of `data-mapper` anywhere in codebase
- [ ] New entity checklist: touches adapter file + domain type only (not 4+ files)
- [ ] Supabase read paths return camelCased fields confirmed via manual smoke test

---

## Risks

| Risk | Mitigation |
|---|---|
| Supabase camelCase flag does not exist in installed version | Verify version before starting; upgrade if needed |
| JSONB columns return nested snake_case (flag may not recurse into JSON) | Audit JSON fields in Class B -- keep explicit deep-transform helpers for those |
| Write-path (`from*` mappers) breaks if Supabase client also camelize-transforms inputs | Test inserts after enabling flag; writes likely unaffected (flag is read-side) |
| TauriAdapter volume makes inline approach unwieldy | Accept a smaller `tauri-mapper.ts` (Option B) if >20 functions -- explicit decision, not default |
| Row type definitions become orphaned or misaligned | Remove or rename `*Row` types to match new camelCase client output; validate with `tsc` |

---

## Execution

`/impl` -- straightforward single-adapter refactor with clear classification steps.
