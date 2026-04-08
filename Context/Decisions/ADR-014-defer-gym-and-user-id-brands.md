# ADR-014: Defer `GymId` and `UserId` brand migration, keep ADR-013 Proposed

## Status

Accepted

## Context

ADR-013 (`Type-safe gym ID propagation across the publishing pipeline`) was
authored in the same branch (`worktree-feat+multipe-instance-display`) that
shipped F019. The ADR's migration strategy explicitly designated F019 as the
single-PR site for the `GymId` brand rollout. The motivating bug class was
the silent broadcast-downgrade pattern uncovered by P14-001, P14-002, P14-005,
P14-006, and P14-007 — raw `string` gym IDs flowing through the publisher,
storage boundary, and channel name builder without any type-level distinction
between a legitimate UUID, the literal `'private'`, an empty string, or
garbage left over from a crashed session.

When the F019 implementation landed, commit `2cb69e1` (`feat(display):
display setup UX and dispatcher routing`) shipped with "Zero new domain
types" in its commit message. The PR review (`Context/Reviews/
0015-pr91-f019-display-setup-ux-review.md` items P15-024 and P15-055)
surfaced that F019 had in fact added **six new raw-string consumers** of
gym IDs:

- `DispatcherState.gymId: string`
- `ParseResult.gymId: string`
- `navigateToGym(gymId: string)` helpers in `display-setup-panel.tsx` and
  `display-chooser.tsx`
- `BackfillFormProps.gymId: string`
- Every test fixture constructing `Gym` literals via object spread rather
  than `gymSchema.parse`

Additionally, P15-055 observed that the `DispatcherInputs.user: { id: string }
| null` structural shape propagates raw `string` user IDs into props that
feed `useGyms`, `useCreateGym`, and the gym-error-messages branch. The same
type-safety gap ADR-013 identified for `GymId` applies symmetrically to
`UserId`: a brand covering only half the problem would still leave
`userId = 'system'` or `userId = ''` reachable at the query-hook boundary.

The state after F019 was therefore strictly worse than three alternatives
the review enumerated:

(a) Land the brand inside F019 before merge (original ADR-013 plan).
(b) Author this ADR explicitly recording the deferral and scope reduction.
(c) Add a high-priority backlog item tracking the deferred migration.

Leaving ADR-013 as "Proposed" with F019 as the named migration site but
shipped, with six new untyped consumers, would leave future readers with
contradictory signals.

## Decision

Defer the `GymId` brand migration until after F019 lands. Keep ADR-013 in
the `Proposed` state but record this ADR as the authoritative explanation
of why the F019 site did not land the brand. When the migration is
scheduled, bundle it with a parallel `UserId` brand so both raw-string ID
types in the publishing pipeline migrate together.

Scope rules for the follow-on migration work:

1. Both brands land in one PR, not two. The publisher / storage / query
   pipeline has symmetric holes for gym and user IDs; migrating only one
   leaves the same bug class reachable through the other.

2. The new brands are additive. Existing `string` call sites receive a
   narrow `asGymId(...)` / `asUserId(...)` constructor at parse/adapter
   boundaries (Supabase adapter, Zod schemas, localStorage reads) so the
   rest of the tree can migrate opportunistically without a big-bang rewrite.

3. `entityId = z.string().min(1)` at `src/domain/types/units.ts:8` must
   also tighten during the migration. The current definition still accepts
   the literal `'private'` as a "valid" ID — the exact bug class ADR-013
   was written to prevent — and any brand rollout that leaves `entityId`
   unchanged is cosmetic.

4. No migration site is a "final migration." If the follow-on PR cannot
   land all six F019 consumers at once, it must still tighten the publisher
   and storage boundaries (where the original P14-001 bug lived) and record
   the remaining consumers in a follow-on backlog item.

## Consequences

### Positive

- F019's PR stays within its stated scope (display setup UX and dispatcher
  routing). The brand migration is a cross-cutting architectural change
  that deserves its own review focus.
- Recording the deferral explicitly removes the contradictory signal
  ("ADR-013 says this will happen in F019") and gives future maintainers
  a single place to look for the migration plan.
- Scoping `GymId` and `UserId` together prevents the "half-migrated" state
  that would leave the original bug class reachable through the
  still-raw-string ID.

### Negative

- F019 merges with six new raw-string gym ID consumers. Each is a future
  migration site. The backlog item (see `Context/Backlog/`) must track
  them explicitly so they do not silently accumulate.
- `entityId` still accepts `'private'` until the follow-on migration. The
  silent-downgrade bug class is partially mitigated by the F019-level
  `configureDisplayPublisher` boundary validation (P14-006) but not
  architecturally prevented.
- Delaying the work increases the risk that a future feature adds a
  seventh or eighth raw-string consumer before the brand lands.

### Neutral

- ADR-013 remains `Proposed`. A future PR that actually lands the
  migration will flip ADR-013 to `Accepted` and link to this ADR as the
  deferral record.

## Alternatives Considered

### Land the brand inside F019 before merge

Rejected. F019's scope was already broad (dispatcher, chooser, setup
panel, inline panel, backfill form, discovery extension, QR scanner hook).
Bundling a cross-cutting brand migration would have extended the PR's
review cycle past an acceptable freeze window and risked further scope
creep. The F019 commits had already been written and reviewed against
the raw-string shape by the time this ADR was authored.

### Land `GymId` only, defer `UserId`

Rejected per P15-055. The two ID types share the same pipeline and the
same bug class. Landing one without the other leaves the original
P14-001-class bug reachable through the untouched half and creates
asymmetric invariants that future maintainers will find confusing.

### Add a backlog item without an ADR

Rejected. The backlog item is necessary but not sufficient. The
contradictory signal (ADR-013 says F019, F019 says zero new types) is an
architectural decision that deserves ADR-level visibility, not a backlog
line item.

## Follow-up

1. Open a backlog item in `Context/Backlog/` naming all six F019
   raw-string consumers and referencing this ADR plus ADR-013.
2. When the migration work is scheduled, link the PR to this ADR and flip
   ADR-013 to `Accepted`.
3. The follow-on PR must update `entityId` in `src/domain/types/units.ts`
   as part of the landing.

## References

- ADR-013 (Proposed): Type-safe gym ID propagation across the publishing
  pipeline
- Review finding P15-024: `Context/Reviews/
0015-pr91-f019-display-setup-ux-review.md`
- Review finding P15-055: same file
- P14-001 / P14-002 / P14-005 / P14-006 / P14-007: originating bug class
