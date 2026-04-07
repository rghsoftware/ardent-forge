# ADR-013: Type-safe gym ID propagation across the publishing pipeline

## Status

Proposed

## Context

Three of the four review agents on PR #91 (`worktree-feat+multipe-instance-display`)
independently identified a single architectural root cause behind the silent
broadcast-downgrade bug class fixed by P14-001, P14-002, P14-005, P14-006, and
P14-007. The pipeline introduced by ADR-012 (gym partitioning) is sound at the
data-flow level but type-leaky at four key boundaries:

1. **`GymPickerChoice` collapses to bare `string`.** The current type is
   `string | 'private'`. Because `'private'` is a subtype of `string`, the
   union narrows to `string`, and consumers cannot pattern-match on `'private'`
   without runtime string equality checks.

2. **`getGymChannelName(gymId: string)` accepts ANY string.** A refactor that
   accidentally passed the literal `'private'` would happily produce
   `'display:gym:private'` -- a phantom channel no subscriber listens on.
   The function has no way to distinguish a legitimate gym UUID from
   `'private'`, an empty string, garbage from localStorage, or
   `'undefined'`.

3. **`getActiveGymId(): string | null` cannot distinguish four operationally
   distinct states.** The current return type collapses "Private intent",
   "publisher unconfigured", "channel torn down", and "publisher not yet
   initialized" into the single value `null`. P14-001/P14-002 had to introduce
   a parallel `_publisherMode` flag to recover the lost information at
   runtime; type-level enforcement would have prevented the bug entirely.

4. **The `'private' → null` conversion is duplicated** at two route handlers
   in `_authenticated/index.tsx`. A future caller that forgets the
   `=== 'private'` check would let the literal `'private'` flow through to
   the publisher.

The five inline `[FIX]` items resolved in this PR (P14-001, P14-002, P14-005,
P14-006, P14-007) are downstream symptoms of the same problem. Without the
type-system fix below, every future caller has to remember to validate at the
boundary by hand -- the project's "Zustand store boundary validation" rule
applied to every consumer of the gym pipeline.

This ADR documents the structural fix; implementation is intentionally NOT
in scope for the F018 PR (the inline `[FIX]`es are sufficient mitigation).
A follow-up F019 will execute the migration in a single PR per the strategy
below.

## Decision

Adopt three composable type-safety primitives for the gym pipeline:

### 1. Discriminated `GymPickerChoice`

```typescript
export type GymPickerChoice = { kind: 'gym'; gymId: GymId } | { kind: 'private' }
```

The discriminated union forces every consumer through explicit case handling.
The `'private' → null` translation now lives in one place: a single
constructor that takes the discriminated value and returns
`{ gymId: GymId | null, intent: PublisherIntent }`. Pattern matching is
exhaustive at the type level.

### 2. Branded `GymId`

```typescript
export type GymId = string & { readonly __brand: unique symbol }

export function toGymId(s: string): GymId {
  if (!UUID_RE.test(s)) {
    throw new Error(`[gym-id] Invalid UUID: ${JSON.stringify(s)}`)
  }
  return s as GymId
}

export function tryToGymId(s: string): GymId | null {
  return UUID_RE.test(s) ? (s as GymId) : null
}
```

The brand is structural-only -- no runtime overhead. The constructor is the
single entry point: any string entering the gym pipeline (from localStorage,
from a URL param, from a Supabase response) must pass through `toGymId` or
`tryToGymId` first. The functions threaded through include:

- `getGymChannelName(gymId: GymId): string`
- `parseGymIdFromChannel(channelName: string): GymId | null`
- `configureDisplayPublisher({ gymId: GymId | null, ... })`
- `getActiveGymId(): GymId | null` (reshaped per #3 below)
- `Gym.id: GymId` in the Zod-inferred domain type

### 3. Discriminated `PublisherState`

```typescript
export type PublisherState =
  | { kind: 'unconfigured' }
  | { kind: 'private' }
  | { kind: 'broadcasting'; gymId: GymId }

export function getPublisherState(): PublisherState {
  // Internal state machine reads _publisherMode + _activeGymId.
}
```

This subsumes the `_publisherMode` + `_activeGymId` parallel state added in
the P14-001/P14-002 inline fix. The four operationally distinct states from
the silent-downgrade bug become compile-level distinct, not runtime-conflated.
Callers branch on `state.kind` and the type system threads `gymId` only into
the branch where it exists.

### Migration strategy

Bottom-up, in a single PR (F019):

1. Add `GymId` brand and `toGymId` constructor to `src/domain/types/gym.ts`.
2. Update `gymSchema` to refine `id` through `toGymId` (Zod's `.refine`).
3. Update `gym-picker-storage.ts` to validate at the storage boundary using
   `tryToGymId` (replaces the regex check from P14-006).
4. Update `getGymChannelName` and `parseGymIdFromChannel` to take/return
   `GymId`.
5. Update `configureDisplayPublisher` to take `GymId | null` and remove the
   string-based runtime guard.
6. Update consumers (`use-display-broadcast`, `_authenticated/index.tsx`,
   `gym-picker-sheet`) to use the discriminated `GymPickerChoice` and
   `PublisherState`.
7. Remove the parallel `_publisherMode` + `_silentDropWarned` state machine
   in favor of `PublisherState`. The silent-drop logging stays but reads from
   the discriminated state instead of the parallel mode flag.

### Zod integration

`z.infer<typeof gymSchema>` must produce `Gym.id: GymId`, not `string`. The
canonical pattern in this codebase is `z.string().refine(...)` with a type
predicate that narrows to the brand. This composes cleanly with the existing
`syncableEntitySchema` extension. ADR-008 (dual-export Zod schemas) is
unaffected -- the brand is a TypeScript-only refinement on the inferred type.

### Out of scope

- Renaming the brand to something other than `GymId` (debated: `GymIdString`,
  `GymUUID` -- left as `GymId` for symmetry with future `UserId`,
  `WorkoutLogId`, etc. once F019 establishes the pattern).
- Generalizing to a project-wide `EntityId<T>` brand. The gym pipeline
  benefits from the brand because of P14-006's silent-downgrade history;
  other domains do not have a similar incident yet. P14-044 (entityId UUID
  refinement) is the precursor to that broader migration -- when F019 lands,
  the entityId migration becomes a one-line change per domain.
- Persisting publisher state to sessionStorage so the refresh case in
  P14-001 self-recovers. That is a separate decision (sessionStorage vs.
  the URL vs. an in-memory cache) and depends on the broader Tauri/web
  state-persistence strategy.

## Consequences

**Benefits:**

- Eliminates the silent-downgrade bug class at compile time. The four
  operationally distinct states from P14-001 become compile-level distinct,
  not runtime-conflated.
- Removes the duplicated `'private' → null` translation from
  `_authenticated/index.tsx`. There is exactly one entry point.
- The `entityId` → `entityIdUuid` refinement (P14-044) becomes a one-line
  change per domain once F019 establishes the brand pattern.
- Future readers see the structural intent in the type names, not in
  scattered runtime guards.

**Trade-offs:**

- Adds one indirection at every gym-pipeline boundary. Callers that today
  pass a raw `string` must wrap it in `toGymId(...)`. The cost is one line
  per call site; the benefit is exhaustive type checking on every consumer.
- The brand requires a small upfront cost to teach (especially for AI
  agents that pattern-match on TypeScript syntax). Mitigated by clear
  doc comments at the constructor.
- Migration touches every file in the gym pipeline (~12 files). Self-
  contained but not zero-risk; needs the `bun run build` + `bun run test`
  full cycle to land cleanly.

**Risks:**

- The Zod `refine` overhead at the parse boundary is real (~few µs per
  parse). Negligible for the gym pipeline (a few parses per workout) but
  worth measuring before generalizing the pattern to high-throughput
  domains.
- TypeScript brand types are structural -- a sufficiently determined
  caller can `as GymId` past the constructor. The brand is a hint, not a
  hard guarantee. Mitigated by lint rules forbidding `as GymId` outside
  the constructor file.
- If F019 is delayed, the parallel `_publisherMode` state machine added
  in P14-001/P14-002 becomes accidental tech debt. Tracked as a follow-up
  to remove once F019 lands.

## Compatibility

**Checked against:**

- **ADR-012 (Gym Partitioning Model):** Compatible. ADR-012 introduces the
  gym entity and the broadcast partitioning at the _data_ layer; ADR-013
  introduces the _type_ layer enforcement of that partitioning. ADR-013
  builds on ADR-012, does not contradict it. The four coupled decisions
  in ADR-012 (gym entity, per-gym channels, auth.users trigger, anon
  column-level GRANT) are unaffected.

- **ADR-008 (Dual Export Zod Schemas):** Compatible. ADR-008 governs how
  schemas are exported; ADR-013 governs how the inferred types are
  refined. The brand on `Gym.id` is a TypeScript-only refinement that
  composes with `z.infer` cleanly.

- **ADR-009 (Normalize No-Overrides Representation):** Compatible. The
  override normalization is orthogonal to the gym pipeline.

- **ADR-010 (Onboarding State Local Storage):** Compatible. The onboarding
  state lives in a different localStorage key and is unrelated to the
  gym picker storage.

- **ADR-007 (Transient Store Deep-Link State):** Compatible. The transient
  store pattern is orthogonal to the publisher state machine -- the
  publisher is module-state by design (not Zustand), and the discriminated
  `PublisherState` from ADR-013 lives at the publisher module level.

No overlapping accepted ADRs found that would be superseded by this decision.

## Related

- **Feature:** Context/Features/018-Gym-Scoped-Displays/ (the source feature)
- **Files affected (when F019 lands):**
  - `src/domain/types/gym.ts` (add `GymId` brand)
  - `src/lib/gym-channel.ts` (update signatures)
  - `src/lib/gym-picker-storage.ts` (use brand at boundary)
  - `src/lib/display-publisher.ts` (replace `_publisherMode` with `PublisherState`)
  - `src/lib/data-mapper.ts` (refine in `toGym`)
  - `src/components/workout/active-workout-gym-label.tsx` (consume `getActiveGymId`)
  - `src/components/workout/gym-picker-sheet.tsx` (consume discriminated `GymPickerChoice`)
  - `src/hooks/use-display-broadcast.ts` (consume discriminated state)
  - `src/routes/_authenticated/index.tsx` (single conversion entry point)
  - `src/routes/display/gym/$gymId.tsx` (parse URL param through `tryToGymId`)
- **Spec sections:** TA4, TA5, TA15
- **Review:** Context/Reviews/0014-pr91-gym-scoped-displays-review.md (P14-034)
