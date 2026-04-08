# GymId + UserId Brand Migration

**Status:** Planned follow-up to F019
**Owner:** TBD
**Priority:** High
**Related ADRs:** ADR-013 (Proposed), ADR-014 (Accepted — deferral record)
**Related reviews:** `Context/Reviews/0015-pr91-f019-display-setup-ux-review.md`
(findings P15-024 and P15-055)

## Summary

ADR-013 was authored to introduce a `GymId` branded type that prevents the
silent broadcast-downgrade bug class uncovered by P14-001 through P14-007.
The ADR designated F019 (display setup UX) as the single-PR migration site.
F019 shipped without the migration, and ADR-014 records the deferral
decision plus the rationale for bundling `UserId` into the same migration.

This backlog item tracks the concrete consumers that must be migrated and
the tightening work on `entityId` / `gymSchema` that must happen alongside.

## Raw-string ID consumers in F019 scope

These are the six F019-introduced call sites that added new raw-string
`GymId` consumers. All must migrate together (or the migration must
explicitly defer each one with a tracked backlog item).

1. `src/components/display/dispatcher-state.ts` — `DispatcherState` union
   variants (`{ kind: 'single', gymId: string }`) and
   `DispatcherInputs.gyms: Gym[] | undefined` — pipeline entry.
2. `src/lib/display-url.ts` — `ParseResult` union (`{ ok: true; gymId:
string }`) and `BuildResult` (`{ ok: true; url: string }` — the url
   encodes the gym ID but the type does not surface it).
3. `src/components/display/display-setup-panel.tsx` — `navigateToGym(gymId:
string)` helper.
4. `src/components/display/display-chooser.tsx` — `navigateToGym(gymId:
string)` helper (same shape, different file).
5. `src/components/profile/show-display-panel.tsx` — `BackfillFormProps.gymId:
string` and the call site at `MyGymRow`.
6. Every test fixture in `src/components/display/__tests__/` that
   constructs `Gym` literals via object spread rather than `gymSchema.parse`.

## Raw-string UserId consumers (added in F019)

P15-055 surfaced the symmetric gap on the user-id side. These must migrate
together with the gym-id brand per ADR-014:

1. `DispatcherInputs.user: { id: string } | null` in `dispatcher-state.ts`.
2. `DisplaySetupPanel` / `DisplayChooser` / `ShowDisplayPanel` `userId:
string` props.
3. `useGyms(userId: string | null | undefined)` in `src/hooks/use-gyms.ts`.
4. `useUserProfile(userId: string)` call sites in display components.

## Out-of-scope tightening (must land in the same PR)

1. `entityId = z.string().min(1)` at `src/domain/types/units.ts` still
   accepts `'private'` as a "valid" ID. This is the single most load-
   bearing coupling that the F019-era boundary validation only papers
   over — a proper brand rollout must tighten `entityId` to reject
   `'private'` and the empty string at the schema level.
2. `gymSchema` and `userProfileSchema` must use the brand-producing
   `z.uuid().brand<'GymId'>()` / `z.uuid().brand<'UserId'>()` patterns
   so parsing at the adapter boundary is the single source of
   brand-production.

## Constructor surface

The migration should add narrow constructor helpers at the adapter
boundary, not at every call site:

```ts
// src/domain/types/units.ts
export const gymIdSchema = z.uuid().brand<'GymId'>()
export type GymId = z.infer<typeof gymIdSchema>

export const userIdSchema = z.uuid().brand<'UserId'>()
export type UserId = z.infer<typeof userIdSchema>

// Constructor: trusted-source-only, not for arbitrary call sites
export function asGymId(raw: string): GymId {
  return gymIdSchema.parse(raw)
}
export function asUserId(raw: string): UserId {
  return userIdSchema.parse(raw)
}
```

Adapters (Supabase data mapper, localStorage read boundary, query hook
parameters) call `asGymId` / `asUserId` once. Everything downstream uses
the branded type.

## Acceptance criteria

1. `entityId` no longer accepts `'private'` or empty string.
2. `gymSchema.id` and `userProfileSchema.id` produce branded types.
3. All six F019 consumers migrated or explicitly deferred with a named
   backlog item.
4. `configureDisplayPublisher` accepts `GymId | null` (not `string | null`).
5. `getGymChannelName` accepts `GymId` (not `string`).
6. All tests updated; no raw `'11111111-...'` fixture literals remain in
   the files listed above (use `asGymId('11111111-...')` or a factory).
7. ADR-013 flipped from `Proposed` to `Accepted`.
8. ADR-014's "When the migration work is scheduled" follow-up is crossed
   off.

## Risks

- Scope creep: there are ~40 other `gymId: string` call sites in the
  codebase outside F019. The PR should migrate the _pipeline_ (publisher,
  subscriber, channel, storage, adapter, query hooks) but can defer pure
  UI call sites to opportunistic follow-ups. Leaving the pipeline untyped
  is unacceptable; leaving a display-only component untyped is OK.
- Test fixtures: forcing every test to go through `asGymId` may require
  a `makeGym` factory (tracked separately in S025-T per review P15-053).
  Land `makeGym` first, then do the brand migration.
