# Tech Plan: Public Visibility

**Spec:** Context/Features/016-Public-Visibility/Spec.md
**Stacks involved:** React/TypeScript (`src/`), Rust/Tauri (`src-tauri/`), Supabase (`supabase/`)

## Architecture Overview

Public visibility adds a read-only discovery layer on top of existing owner-only
data. The core change is a new `is_public` flag on exercises and session
templates (programs already have it), RLS policies that grant authenticated
SELECT when the flag is true, and a "Mine / Public" scope filter in the UI that
switches queries between owner-scoped and public-scoped modes.

```
┌─────────────────────────────────────────────────────┐
│  Library / Exercises UI                             │
│  ┌───────────┐  ┌────────────┐  ┌───────────────┐  │
│  │ Scope     │  │ Search     │  │ Category /    │  │
│  │ Mine|Pub  │  │ Input      │  │ Filters       │  │
│  └─────┬─────┘  └─────┬──────┘  └──────┬────────┘  │
│        └───────────────┼────────────────┘           │
│                        ▼                            │
│              Filter object (scope, search, ...)     │
│                        │                            │
│                        ▼                            │
│              usePrograms / useSessionTemplates /     │
│              useExercises (with filters)             │
│                        │                            │
│                        ▼                            │
│              DataAdapter.getX(filters)               │
│              ┌─────────┴──────────┐                 │
│              ▼                    ▼                  │
│     SupabaseAdapter         TauriAdapter            │
│     (RLS handles scope)     (SQL WHERE clause)      │
└─────────────────────────────────────────────────────┘
```

The read-only detail views and clone actions sit alongside existing patterns:
`SharedProgramView` is already a read-only renderer, and `useCloneProgram`
already handles program duplication. Template cloning is new.

## Key Decisions

### D1: RLS Policy Pattern for Public Content

**Options considered:**

- **A: Simple OR clause** -- amend existing SELECT policies to add
  `OR is_public = true` (or for child tables, join to parent and check
  `is_public`). Straightforward, mirrors the `is_custom = false` pattern on
  exercises.
- **B: Separate policy per access mode** -- create new named policies like
  `programs_public_select` alongside existing `programs_select`. More granular
  but doubles the policy count.
- **C: SECURITY DEFINER RPC** -- bypass RLS entirely for public reads via a
  function, like the share link RPCs. Avoids policy complexity but loses
  row-level filtering.

**Chosen:** Option B (separate policies)

**Rationale:** Separate policies keep each access mode independently auditable
and droppable. The existing codebase already uses this pattern for coach access
(e.g., `programs_coach_select` alongside `programs_select`). Adding `OR` clauses
to existing policies risks breaking the owner and coach policies if the public
check has unexpected performance characteristics. Postgres evaluates policies
with OR logic between them, so the behavior is identical to option A but with
cleaner separation.

**New policies needed:**

| Table                | Policy name                        | USING clause                                                                                            |
| -------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `programs`           | `programs_public_select`           | `is_public = true`                                                                                      |
| `blocks`             | `blocks_public_select`             | `EXISTS (SELECT 1 FROM programs WHERE id = blocks.program_id AND is_public)`                            |
| `block_weeks`        | `block_weeks_public_select`        | `EXISTS (SELECT 1 FROM blocks JOIN programs ... AND is_public)`                                         |
| `scheduled_sessions` | `scheduled_sessions_public_select` | `EXISTS (SELECT 1 FROM block_weeks JOIN blocks JOIN programs ... AND is_public)`                        |
| `session_templates`  | `session_templates_public_select`  | `is_public = true`                                                                                      |
| `activity_groups`    | `activity_groups_public_select`    | `EXISTS (SELECT 1 FROM session_templates WHERE id = activity_groups.session_template_id AND is_public)` |
| `activities`         | `activities_public_select`         | `EXISTS (SELECT 1 FROM activity_groups JOIN session_templates ... AND is_public)`                       |
| `exercises`          | `exercises_public_select`          | `is_custom = true AND is_public = true`                                                                 |

### D2: Cascading Publish Implementation

**Options considered:**

- **A: Client-side multi-update** -- the frontend identifies all referenced
  templates and exercises, then issues separate UPDATE calls for each.
  Simple but non-atomic and chatty.
- **B: SECURITY DEFINER RPC** -- a single `publish_program(program_id)` function
  that transactionally sets `is_public = true` on the program, its referenced
  templates (via `scheduled_sessions -> session_templates`), and their referenced
  custom exercises (via `activities -> exercises`). Atomic, single round-trip.
- **C: Database trigger** -- `AFTER UPDATE ON programs` trigger that cascades
  when `is_public` changes to true. Implicit and hard to reason about.

**Chosen:** Option B (SECURITY DEFINER RPC)

**Rationale:** Atomicity matters here -- a half-published program with private
templates would be broken. The RPC pattern is already established for
cross-boundary operations (`assign_program_to_member`, `get_shared_program`).
A single RPC also simplifies the UI: one confirmation dialog, one mutation call,
one success/error state.

```sql
CREATE OR REPLACE FUNCTION publish_program(p_program_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM programs
    WHERE id = p_program_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not the program owner';
  END IF;

  -- Publish the program
  UPDATE programs SET is_public = true, updated_at = now()
  WHERE id = p_program_id;

  -- Publish all referenced session templates
  UPDATE session_templates SET is_public = true, updated_at = now()
  WHERE id IN (
    SELECT DISTINCT ss.session_template_id
    FROM scheduled_sessions ss
    JOIN block_weeks bw ON bw.id = ss.block_week_id
    JOIN blocks b ON b.id = bw.block_id
    WHERE b.program_id = p_program_id
      AND ss.session_template_id IS NOT NULL
  );

  -- Publish all custom exercises referenced by those templates
  UPDATE exercises SET is_public = true, updated_at = now()
  WHERE is_custom = true
    AND id IN (
      SELECT DISTINCT a.exercise_id
      FROM activities a
      JOIN activity_groups ag ON ag.id = a.activity_group_id
      WHERE ag.session_template_id IN (
        SELECT DISTINCT ss.session_template_id
        FROM scheduled_sessions ss
        JOIN block_weeks bw ON bw.id = ss.block_week_id
        JOIN blocks b ON b.id = bw.block_id
        WHERE b.program_id = p_program_id
          AND ss.session_template_id IS NOT NULL
      )
    );
END;
$$;
```

Unpublishing is simpler: a direct `UPDATE programs SET is_public = false` on the
single program. Templates and exercises remain independently published per
PV-M6.

Similarly, `publish_session_template(template_id)` cascades to referenced
custom exercises only.

Individual exercise publish/unpublish is a direct UPDATE (no cascade needed).

### D3: Search and Filtering Infrastructure

**Chosen:** Follow the exercises pattern exactly.

The exercises page (`src/routes/_authenticated/exercises/index.tsx`) is the
established search/filter reference implementation. Programs and templates will
replicate this pattern:

1. **Filter types** on the `DataAdapter` interface:

```typescript
// Already exists
interface ExerciseFilters {
  category?: ExerciseCategory
  movementPattern?: MovementPattern
  muscleGroup?: MuscleGroup
  searchQuery?: string
  isCustom?: boolean
  scope?: 'mine' | 'public' // NEW
}

// New
interface ProgramFilters {
  searchQuery?: string
  source?: ProgramSource
  scope?: 'mine' | 'public'
}

// New
interface SessionTemplateFilters {
  searchQuery?: string
  category?: SessionCategory
  scope?: 'mine' | 'public'
}
```

2. **Query hooks** updated to accept filter objects:

```typescript
// usePrograms(userId) -> usePrograms(userId, filters?)
// useSessionTemplates(userId) -> useSessionTemplates(userId, filters?)
// useExercises(filters?) -> add scope to ExerciseFilters
```

3. **Adapter methods** updated to accept and apply filters:
   - `getPrograms(userId, filters?)` -- Supabase: `.ilike('name', pattern)`,
     `.eq('source', ...)`, scope logic. Tauri: SQL WHERE clauses.
   - `getSessionTemplates(userId, filters?)` -- same pattern.
   - `getExercises(filters?)` -- add scope handling.

4. **Scope filter logic** in adapters:
   - `scope: 'mine'` (default) -- current behavior (`user_id = auth.uid()`)
   - `scope: 'public'` -- query `is_public = true` (RLS handles auth)
   - For Supabase: `scope === 'public'` omits the `user_id` filter and adds
     `.eq('is_public', true)`
   - For Tauri/SQLite: `scope === 'public'` queries `WHERE is_public = 1`
     (local data only -- public content from other users will not be in the
     local SQLite DB unless synced; this is acceptable since public browse is
     an online-only feature)

5. **UI components** -- reuse `ExerciseSearchInput` pattern (extract to a shared
   `SearchInput` component or duplicate with minimal variation). Filter chips
   follow the `ExerciseFilterBar` pattern. Scope toggle is a segmented control
   ("Mine" / "Public") above the search/filter area.

### D4: Scope Toggle as Online-Only Feature

**Context:** The Tauri app uses local SQLite for offline capability. Public
content from other users will not exist in a user's local SQLite database.

**Decision:** The "Public" scope is an online-only query. When scope is
"Public":

- **SupabaseAdapter**: queries Supabase directly with `is_public = true`
- **TauriAdapter**: queries the Supabase remote database (not local SQLite).
  This matches the pattern used by share link resolution, which also requires
  network access.

When scope is "Mine" (default): existing behavior, works offline via
TauriAdapter's local SQLite.

### D5: Template Clone Flow

**Options considered:**

- **A: Client-side deep copy** -- read the full template (groups + activities),
  generate new IDs, insert via `createSessionTemplate` + `createActivityGroup` +
  `createActivity` calls.
- **B: SECURITY DEFINER RPC** -- `clone_session_template(template_id)` that
  does the deep copy server-side in one transaction.

**Chosen:** Option B (SECURITY DEFINER RPC)

**Rationale:** A template has a three-level hierarchy
(template -> groups -> activities). Client-side copying requires reading the
full tree, generating new IDs, and issuing N+1 inserts. A server-side RPC is
atomic, avoids round-trips, and handles ID generation internally. The existing
program clone is client-side, but it strips template references and is simpler.
Template cloning must preserve the full activity tree.

```sql
CREATE OR REPLACE FUNCTION clone_session_template(
  p_template_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_template_id UUID;
  v_old_group_id UUID;
  v_new_group_id UUID;
BEGIN
  -- Clone the template
  INSERT INTO session_templates (user_id, name, description, category,
    rest_between_groups, time_cap, scoring, is_public)
  SELECT p_user_id, name, description, category,
    rest_between_groups, time_cap, scoring, false
  FROM session_templates WHERE id = p_template_id
  RETURNING id INTO v_new_template_id;

  -- Clone activity groups and their activities
  FOR v_old_group_id, v_new_group_id IN
    INSERT INTO activity_groups (session_template_id, group_type, ordinal,
      rounds, rest_between_rounds, time_cap)
    SELECT v_new_template_id, group_type, ordinal,
      rounds, rest_between_rounds, time_cap
    FROM activity_groups WHERE session_template_id = p_template_id
    RETURNING (SELECT id FROM activity_groups orig
               WHERE orig.session_template_id = p_template_id
                 AND orig.ordinal = activity_groups.ordinal) AS old_id,
             id AS new_id
  LOOP
    INSERT INTO activities (activity_group_id, exercise_id, set_scheme, ordinal,
      notes, rest_between_sets)
    SELECT v_new_group_id, exercise_id, set_scheme, ordinal,
      notes, rest_between_sets
    FROM activities WHERE activity_group_id = v_old_group_id;
  END LOOP;

  RETURN v_new_template_id;
END;
$$;
```

### D6: Author Attribution

**Decision:** Public content displays the author's display name by joining to
`auth.users` or the app's `profiles` table. For list views, the query includes
the author's display name. For detail views, the author name is shown in the
header.

This requires a profile lookup. The existing `SharedProgramView` does not show
author info, so this is new. The simplest approach: add a `profiles` join in the
public query RPCs, or include `created_by` / `user_id` in the response and
resolve the display name client-side via a lightweight `useProfile(userId)` hook.

**Chosen:** Include `user_id` in the public query response and resolve display
name client-side. This avoids coupling the list query to the profiles table and
allows caching profile lookups across multiple items by the same author.

## Stack-Specific Details

### Supabase (`supabase/`)

**New migration file:** `supabase/migrations/YYYYMMDDHHMMSS_add_public_visibility.sql`

Contents:

1. `ALTER TABLE session_templates ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false`
2. `ALTER TABLE exercises ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false`
3. Eight new SELECT policies (see D1 table)
4. `publish_program()` RPC (see D2)
5. `publish_session_template()` RPC (cascades to exercises)
6. `clone_session_template()` RPC (see D5)
7. Indexes: `idx_programs_is_public`, `idx_session_templates_is_public`,
   `idx_exercises_is_public` (partial indexes on `is_public = true` for
   efficient public queries)

**Patterns to follow:** `.claude/rules/supabase.md` -- separate policies per
operation, `auth.uid()` for ownership, snake*case naming, `idx*[table]\_[columns]`
index naming.

### React/TypeScript (`src/`)

**Files to modify:**

| File                                            | Change                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/types/exercise.ts`                  | Add `isPublic: z.boolean()` to schema                                                                                                 |
| `src/domain/types/session.ts`                   | Add `isPublic: z.boolean()` to `sessionTemplateSchema`                                                                                |
| `src/lib/data-adapter.ts`                       | Add `ProgramFilters`, `SessionTemplateFilters` interfaces; add `scope` to `ExerciseFilters`; update method signatures                 |
| `src/lib/supabase-adapter.ts`                   | Implement filtered queries with scope logic; add `publishProgram()`, `publishSessionTemplate()`, `cloneSessionTemplate()`             |
| `src/lib/tauri-adapter.ts`                      | Implement filtered queries; public scope routes to Supabase (online-only)                                                             |
| `src/lib/data-mapper.ts`                        | Add `is_public` mapping for exercises and session templates                                                                           |
| `src/hooks/use-exercises.ts`                    | Add `scope` support to `useExercises`                                                                                                 |
| `src/hooks/use-programs.ts`                     | Update `usePrograms` to accept `ProgramFilters`; add `usePublishProgram` mutation                                                     |
| `src/hooks/use-session-templates.ts`            | Update `useSessionTemplates` to accept `SessionTemplateFilters`; add `usePublishSessionTemplate`, `useCloneSessionTemplate` mutations |
| `src/routes/_authenticated/library.tsx`         | Add search input, filter chips, scope toggle to both tabs                                                                             |
| `src/routes/_authenticated/exercises/index.tsx` | Add scope toggle                                                                                                                      |

**Files to create:**

| File                                                | Purpose                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/components/shared/scope-toggle.tsx`            | "Mine / Public" segmented control, reusable across all three list views                           |
| `src/components/shared/search-input.tsx`            | Extract from `ExerciseSearchInput` or create shared version                                       |
| `src/components/library/program-filter-bar.tsx`     | Filter chips for programs (source)                                                                |
| `src/components/library/template-filter-bar.tsx`    | Filter chips for templates (category)                                                             |
| `src/components/library/public-program-detail.tsx`  | Read-only detail view for a public program (wraps/adapts `SharedProgramView`)                     |
| `src/components/library/public-template-detail.tsx` | Read-only detail view for a public template                                                       |
| `src/components/library/publish-dialog.tsx`         | Confirmation dialog for publishing (program cascading message or simple template/exercise toggle) |

**Patterns to follow:**

- `.claude/rules/react-typescript.md` -- TanStack Query key pattern
  `[domain, action, params]`, file naming `lowercase-with-dashes`
- `.claude/rules/state-management.md` -- filter state lives in route component
  via `useState`, not in a Zustand store (ephemeral UI state)
- `.claude/rules/error-handling.md` -- mutation hooks surface errors to UI;
  publish/clone failures show toast or error state
- `.claude/rules/typescript-conventions.md` -- `satisfies Record<K, V>` for any
  label maps keyed by domain unions
- `.claude/rules/layout-conventions.md` -- `max-w-5xl`, progressive padding

### Rust/Tauri (`src-tauri/`)

**Files to modify:**

| File                                          | Change                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src-tauri/src/models.rs`                     | Add `is_public: Option<i32>` to `ExerciseRow` and `is_public: i64` to `SessionTemplateRow` |
| `src-tauri/src/commands/exercises.rs`         | Add `is_public` to INSERT/UPDATE SQL, add to struct fields                                 |
| `src-tauri/src/commands/session_templates.rs` | Add `is_public` to INSERT/UPDATE SQL, add to input struct                                  |

**SQLite migration:** Add `is_public INTEGER NOT NULL DEFAULT 0` to both tables
in the local SQLite schema. The Tauri sync layer handles pulling the column from
Supabase.

**Patterns to follow:** `.claude/rules/rust-tauri.md` -- `Result<T, String>`,
`?` over `unwrap()`, SQLx for queries.

## Integration Points

### Publish Flow

```
UI (Publish button) -> PublishDialog (confirmation)
  -> usePublishProgram mutation
    -> SupabaseAdapter.publishProgram(programId)
      -> supabase.rpc('publish_program', { p_program_id })
        -> Sets is_public on program + templates + exercises (atomic)
    -> Invalidates ['programs'], ['session-templates'], ['exercises'] queries
```

### Clone Flow (Template)

```
UI (Clone button on public template detail)
  -> useCloneSessionTemplate mutation
    -> SupabaseAdapter.cloneSessionTemplate(templateId)
      -> supabase.rpc('clone_session_template', { p_template_id })
        -> Returns new template ID
    -> Invalidates ['session-templates'] query
    -> Navigate to the cloned template
```

### Scope Filter Flow

```
UI (ScopeToggle: Mine | Public)
  -> Updates scope state in route component
    -> Filter object changes -> query key changes -> TanStack Query re-fetches
      -> scope='mine': adapter.getPrograms(userId, { scope: 'mine' })
         (existing behavior, user_id filter)
      -> scope='public': adapter.getPrograms(userId, { scope: 'public' })
         (Supabase: is_public=true, no user_id filter; RLS allows read)
```

## Risks & Unknowns

| Risk                                                         | Likelihood | Impact | Mitigation                                                                                                                           |
| ------------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| RLS policy performance on child tables (nested EXISTS joins) | Medium     | Medium | Partial indexes on `is_public = true`; EXPLAIN ANALYZE during testing                                                                |
| Public scope on TauriAdapter requires network                | Low        | Low    | Show clear "requires connection" state; public browse is inherently online                                                           |
| Cascading publish touches many rows                          | Low        | Low    | RPC is transactional; worst case is a timeout on very large programs                                                                 |
| Name uniqueness on exercises after clone                     | Medium     | Medium | Cloned exercises keep original IDs (no duplication); cloned templates get new IDs with same name (names are not unique on templates) |

## Testing Strategy

**Database layer (Supabase):**

- RLS policy tests: verify public SELECT works for non-owners, verify private
  SELECT is denied, verify child table access follows parent visibility
- RPC tests: publish cascade sets all flags, clone produces valid deep copy,
  ownership checks prevent unauthorized publish

**Frontend (Vitest + Testing Library):**

- Hook tests: verify query keys include filters, verify scope changes trigger
  re-fetch
- Component tests: scope toggle renders and switches, filter chips toggle,
  search input debounces, publish dialog shows correct message

**Integration (manual):**

- End-to-end publish -> browse -> clone -> verify cloned content
- Unpublish -> verify removal from public results
- Offline behavior: "Mine" works, "Public" shows connection-required state
