# Tech Plan: Gym Membership Explicit

**Spec:** [Context/Features/021-Gym-Membership-Explicit/Spec.md](./Spec.md)
**Stacks involved:** Supabase (Postgres + RLS + RPCs), React 19 + TypeScript, TanStack Router, TanStack Query, shadcn UI / Tailwind 4

## Architecture Overview

Feature 021 is a two-workstream change on top of the F018 gym foundation:

1. **Decoupling.** One Supabase migration surgically removes the
   `trg_auth_user_default_gym` trigger, the `enroll_new_user_in_default_gym`
   function, and the `gyms.is_default` column (plus its partial unique index
   `idx_gyms_one_default`). Existing `gym_members` rows — including the 018
   backfill — are untouched, and the "Home" gym row is kept. `is_default`
   references in frontend types/mappers/tests are cleaned up. No runtime
   logic currently reads `is_default`, so the removal is mechanical.

2. **Admin surface + invites + transfers.** Two new tables
   (`gym_invitations`, `gym_ownership_transfers`) plus four new
   `security definer` RPCs (`redeem_gym_invite`, `propose_gym_transfer`,
   `accept_gym_transfer`, `cancel_or_decline_gym_transfer`) and one new
   view (`gym_member_counts`) for the N+1 fix. Frontend ships a new nested
   route `/profile/gyms/$gymId`, two new hook files
   (`use-gym-invites.ts`, `use-gym-transfers.ts`), extensions to the
   existing `use-gyms.ts` / `use-gym-members.ts` hooks, and a
   token-redemption deep link at `/gyms/join` that reuses the F011
   redirect-with-return-to pattern.

The broadcast-scoping logic in `20260407000002_replace_idle_sessions_rpc.sql`
continues to read `gym_members` unchanged — nothing about display-scoping
depends on `is_default`.

## Data Model Changes

### Dropped

- Trigger `trg_auth_user_default_gym` on `auth.users`
  (`20260407000001_create_gyms.sql:270-272`).
- Function `public.enroll_new_user_in_default_gym()` (lines 241-263).
- Column `gyms.is_default` (line 34) and partial unique index
  `idx_gyms_one_default` (lines 50-52).

The one-shot backfill `do $$` block (lines 318-366) is _not_ re-run and
_not_ undone — its effects (the "Home" gym and its `gym_members` rows)
are grandfathered.

### New table: `gym_invitations`

```sql
create table public.gym_invitations (
    id           uuid primary key default gen_random_uuid(),
    gym_id       uuid not null references public.gyms(id) on delete cascade,
    token        text not null,                     -- opaque, URL-safe
    created_by   uuid not null references auth.users(id),
    created_at   timestamptz not null default now(),
    expires_at   timestamptz not null,
    max_uses     integer not null check (max_uses > 0),
    uses_count   integer not null default 0 check (uses_count >= 0),

    constraint gym_invitations_uses_within_max
        check (uses_count <= max_uses)
);

create unique index idx_gym_invitations_token
    on public.gym_invitations(token);

create index idx_gym_invitations_gym_id
    on public.gym_invitations(gym_id);
```

Token format: base64url-encoded 24 random bytes (→ 32 URL-safe chars),
generated server-side inside the `security definer` create-invite RPC via
`pgcrypto`'s `gen_random_bytes(24)` + `encode(..., 'base64')` with `+/`
substituted for `-_`. Satisfies A-014's "token length ≥ 24" bound.

### New table: `gym_ownership_transfers`

```sql
create table public.gym_ownership_transfers (
    gym_id        uuid primary key references public.gyms(id) on delete cascade,
    proposed_by   uuid not null references auth.users(id),
    proposed_to   uuid not null references auth.users(id),
    proposed_at   timestamptz not null default now(),

    constraint gym_ownership_transfers_not_self
        check (proposed_by <> proposed_to)
);
```

`gym_id` as primary key enforces the single-pending invariant (A-013c) at
the schema level — a new `propose_gym_transfer` call uses `on conflict
(gym_id) do update` to supersede the prior pending row.

### New view: `gym_member_counts`

```sql
create or replace view public.gym_member_counts
with (security_invoker = true) as
select g.id as gym_id, count(gm.user_id)::int as member_count
from public.gyms g
left join public.gym_members gm on gm.gym_id = g.id
group by g.id;
```

`security_invoker = true` makes the view honor the caller's RLS against
`gyms` and `gym_members`, so the existing "SELECT all" policy carries
through without a dedicated view policy. Frontend hits this view once per
browse-list query, killing the N+1.

### Dependencies

- Enable `pgcrypto` (not yet present in any migration). New migration:
  `20260408000001_enable_pgcrypto.sql`.
- Drop + new tables + view in: `20260408000002_gym_membership_explicit.sql`.
- RPC definitions in the same migration (kept together for atomicity).

## RLS & Security

### `gym_invitations`

- `select`: only `auth.uid() = (select owner_user_id from gyms where id = gym_id)`.
  Members and non-members cannot enumerate invites.
- `insert`: denied at the policy level. Creation is funneled through
  `create_gym_invite(gym_id, expires_at, max_uses)` which is
  `security definer` and checks `auth.uid()` against `gyms.owner_user_id`.
- `update` / `delete`: denied. `uses_count` increments happen only inside
  the redemption RPC under elevated privileges.

### `gym_ownership_transfers`

- `select`: `auth.uid() in (proposed_by, proposed_to)` — owner and target
  both need visibility.
- `insert` / `update` / `delete`: denied. All lifecycle operations go
  through `security definer` RPCs.

### RPCs (all `security definer`, locked `search_path = public`)

1. `public.create_gym_invite(p_gym_id uuid, p_expires_at timestamptz default now() + interval '7 days', p_max_uses int default 10) returns gym_invitations`
   - Asserts `auth.uid() = gyms.owner_user_id`.
   - Generates token from `pgcrypto`.
   - Inserts and returns the row.

2. `public.redeem_gym_invite(p_token text) returns uuid` (returns the `gym_id`)
   - `select ... for update` on the matching `gym_invitations` row.
   - Returns distinct `raise exception` codes via `errcode`:
     `'P0001'` + message `INVITE_INVALID`, `INVITE_EXPIRED`,
     `INVITE_EXHAUSTED`. Frontend branches on the message suffix.
   - Inserts `(gym_id, auth.uid())` into `gym_members` with
     `on conflict do nothing` (idempotent if the user is already in).
   - `update gym_invitations set uses_count = uses_count + 1` atomically.

3. `public.propose_gym_transfer(p_gym_id uuid, p_target uuid) returns void`
   - Asserts caller is owner, target is a current `gym_members` row, target
     ≠ caller.
   - `insert into gym_ownership_transfers ... on conflict (gym_id) do update`
     — supersedes any prior pending.

4. `public.accept_gym_transfer(p_gym_id uuid) returns void`
   - Asserts caller = `proposed_to` on the pending row.
   - `update gyms set owner_user_id = auth.uid() where id = p_gym_id` and
     `delete from gym_ownership_transfers where gym_id = p_gym_id` in the
     same transaction.

5. `public.cancel_or_decline_gym_transfer(p_gym_id uuid) returns void`
   - Asserts caller is `proposed_by` or `proposed_to`.
   - `delete from gym_ownership_transfers where gym_id = p_gym_id`.

All RPCs follow the pattern established by
`20260407000003_lock_gym_helper_functions.sql`: `security definer`,
`set search_path = public`, explicit grant to `authenticated`.

## Key Decisions

### Decision 1: Pending-transfer schema — table vs. nullable columns on `gyms`

**Options considered:**

- **Option A: Dedicated `gym_ownership_transfers` table** (chosen).
  `gym_id` as primary key enforces the single-pending invariant natively.
  RLS is scoped to the transfer table and doesn't leak into `gyms` read
  paths. Cascade on `gyms` delete is one line.
- **Option B: Nullable columns on `gyms`** (`pending_transfer_to`,
  `pending_transfer_at`, `pending_transfer_by`).
  Saves a table but widens the `gyms` row for a transient state that most
  gyms never have. Complicates `gyms` RLS because the target user needs to
  see the pending-transfer fields but not necessarily other owner-only
  metadata. Harder to audit if we ever want transfer history.

**Chosen:** Option A.
**Rationale:** A dedicated table keeps `gyms` lean, uses the PK constraint
as the single-pending enforcement mechanism (simpler than a partial unique
index on nullable columns), and isolates RLS. The extra table cost is
negligible at friends-and-family scale.
**Related ADRs:** ADR-012-gym-partitioning-model (establishes that
gym-scoped state lives in gym-keyed tables under RLS).

### Decision 2: Invite redemption — `security definer` RPC vs. direct RLS

**Options considered:**

- **Option A: `security definer` `redeem_gym_invite` RPC** (chosen).
  Runs as superuser, can read the invite row, validate, insert into
  `gym_members`, and increment `uses_count` atomically. Clean error
  surface via `raise exception` with distinct codes for
  expired/exhausted/invalid.
- **Option B: Direct RLS with a `can_redeem_invite()` predicate**.
  Would require letting non-members SELECT `gym_invitations` by token,
  then letting them INSERT their own `gym_members` row if the invite is
  valid. Splits atomicity across two statements and leaks invite existence
  to anyone guessing tokens. Validation logic duplicated across INSERT
  policy and app code.

**Chosen:** Option A.
**Rationale:** Single-transaction atomicity, no invite-row visibility for
non-owners, cleaner error taxonomy. Matches the pattern in
`20260407000004_enroll_gym_creator.sql`.
**Related ADRs:** ADR-012-gym-partitioning-model.

### Decision 3: Member count fix — view vs. per-gym query vs. denormalized column

**Options considered:**

- **Option A: `gym_member_counts` view with `security_invoker`** (chosen).
  One SELECT call returns `(gym_id, member_count)` for every visible gym.
  No schema mutation hooks needed — count is always live.
- **Option B: Denormalized `gyms.member_count` column** kept current by
  triggers on `gym_members` insert/delete.
  Faster reads but adds two triggers and a consistency risk.
- **Option C: Per-gym `count` query in a `useGymMemberCount(gymId)` hook**.
  N+1 over the browse list — the problem we're trying to fix.

**Chosen:** Option A.
**Rationale:** Live, zero trigger overhead, trivial migration, and
`security_invoker` keeps RLS coherent with the base tables.
**Related ADRs:** none.

### Decision 4: Error taxonomy for invite redemption

**Chosen:** Use `raise exception` with a structured `message` of the form
`INVITE_INVALID`, `INVITE_EXPIRED`, `INVITE_EXHAUSTED`. Frontend adapter
detects the prefix on the returned PostgrestError message and maps to a
discriminated union (`{ kind: 'invalid' | 'expired' | 'exhausted' }`).
Satisfies A-016 and A-017's "distinct error" requirement without
introducing a custom SQLSTATE.
**Related ADRs:** none; aligns with `.claude/rules/error-handling.md`
"distinguish input-validation from transport failures."

### Decision 5: Deep-link redemption route

**Chosen:** `/gyms/join?token=...` as a new top-level route.
Unauthenticated users hitting it are redirected to sign-in with a
`returnTo=/gyms/join?token=...` query param (reuses F011's
redirect-with-return-to pattern). After sign-in, the route calls the
`redeem_gym_invite` RPC, handles the discriminated error, and on success
navigates to `/profile/gyms/$gymId`.
**Related ADRs:** ADR-007-transient-store-deep-link-state (if we need
session-scoped token buffering; likely not since the token is in the URL).

## Stack-Specific Details

### Supabase

- **New migrations:**
  - `20260408000001_enable_pgcrypto.sql` — `create extension if not exists "pgcrypto"`.
  - `20260408000002_gym_membership_explicit.sql` — drops (`trg_auth_user_default_gym`,
    `enroll_new_user_in_default_gym`, `gyms.is_default`, `idx_gyms_one_default`),
    new tables, view, RLS policies, and all five RPCs.
- **Grants:** `grant execute ... to authenticated` on every new RPC.
  `grant select on gym_member_counts to authenticated`.
- **Patterns to follow:** `.claude/rules/supabase.md` (lowercase SQL,
  snake_case, `security definer` + locked `search_path`, idempotent where
  practical). RPC style mirrors `20260407000003_lock_gym_helper_functions.sql`.
- **Tests:** New `supabase/tests/021_*.sql` files (plain SQL DO-blocks per
  F018 precedent). Coverage per the A-001 through A-021 matrix.

### React / TypeScript

- **Files to create:**
  - `src/routes/_authenticated/profile.gyms.$gymId.tsx` — gym detail page.
  - `src/routes/gyms.join.tsx` — token-redemption deep link (outside
    `_authenticated` so it can handle the unauthenticated pre-redirect case).
  - `src/components/profile/gym-detail/` — `gym-detail-header.tsx`,
    `gym-roster.tsx`, `gym-owner-actions.tsx`, `pending-transfer-banner.tsx`,
    `gym-invite-dialog.tsx`.
  - `src/hooks/use-gym-invites.ts` — `useCreateGymInvite`,
    `useListGymInvites`, `useRedeemGymInvite`.
  - `src/hooks/use-gym-transfers.ts` — `usePendingGymTransfer`,
    `useProposeGymTransfer`, `useAcceptGymTransfer`,
    `useCancelOrDeclineGymTransfer`.

- **Files to modify:**
  - `src/lib/supabase-adapter.ts` — add adapter methods for the five new
    RPCs and the `gym_member_counts` view read; remove `is_default` from
    `getGym` / `listAllGyms` / `listUserGyms` return shapes.
  - `src/lib/database.types.ts` — regenerate after migration, strip
    `is_default` references.
  - `src/lib/data-mapper.ts` — drop `is_default` mapping.
  - `src/lib/__tests__/supabase-adapter-gym.test.ts` and
    `data-mapper-gym.test.ts` — remove `is_default` assertions.
  - `src/domain/types/gym.ts` — drop `isDefault` from `Gym`.
  - `src/hooks/use-gyms.ts` — add `useListAllGymsWithCounts` (hits the
    view) to replace the `--` placeholder path. Extend optimistic updates.
  - `src/hooks/use-gym-members.ts` — no breaking changes; add a
    `useGymRoster(gymId)` wrapper that joins display names from
    `user_profiles` (already SELECT-able per 018 RLS).
  - `src/components/profile/gym-management-section.tsx` — replace `--`
    placeholder with real counts via new hook; link each row to
    `/profile/gyms/$gymId`.
  - `src/lib/deep-link-handler.ts` — recognize `ardentforge://gyms/join?token=...`
    and defer to the React route (parity with F011's `/setup` dispatch).

- **Patterns to follow:**
  - `.claude/rules/error-handling.md`: every new mutation hook has
    `onError` with `[gyms]` or `[gym-invites]` prefix logs and optimistic
    rollback where relevant (A-021).
  - `.claude/rules/typescript-conventions.md`: `satisfies Record<K, V>`
    for any exhaustive constant maps (e.g., invite error → user message).
  - `.claude/rules/layout-conventions.md`: `mx-auto max-w-5xl` wrapper on
    the detail page, tonal depth for section breaks (no dividers).
  - `.claude/rules/state-management.md`: Zustand only if a pending-
    transfer banner needs cross-route state; prefer query-cache reads.

### Routing

- `src/routes/_authenticated/profile.gyms.$gymId.tsx` creates
  `/profile/gyms/:gymId` via TanStack Router's file-based dot-notation
  nesting (matches existing `groups.$groupId.tsx` / `events.$templateId.tsx`).
- `src/routes/gyms.join.tsx` sits outside `_authenticated` and handles the
  redirect-to-sign-in path with `returnTo` when unauthenticated.

## Integration Points

| Contract                                                   | Producer                    | Consumer                               |
| ---------------------------------------------------------- | --------------------------- | -------------------------------------- |
| `gym_member_counts` view                                   | migration                   | `use-gyms.ts` / gym-management-section |
| `create_gym_invite` RPC → `GymInvitation`                  | migration                   | `use-gym-invites.ts` → adapter         |
| `redeem_gym_invite` RPC → `gym_id` or discriminated error  | migration                   | `/gyms/join` route + adapter           |
| `propose/accept/cancel/decline` transfer RPCs              | migration                   | `use-gym-transfers.ts` → adapter       |
| `ardentforge://gyms/join?token=...` deep link              | `src/lib/deep-link-handler` | `/gyms/join` route                     |
| `/profile/gyms/$gymId` (browse list link target)           | profile gym-management UI   | new detail page                        |
| Supabase → generated `database.types.ts` (is_default drop) | migration                   | adapter, mappers, tests                |

## Risks & Mitigations

- **Risk:** RLS on `gym_ownership_transfers` accidentally lets non-parties
  SELECT pending rows.
  - **Mitigation:** Policy strictly scoped to
    `auth.uid() in (proposed_by, proposed_to)`. SQL test iterates three
    personas (owner, target, third party) and asserts visibility.

- **Risk:** Token leakage via shared log lines, referrer headers, or
  browser history when hitting `/gyms/join?token=...`.
  - **Mitigation:** (a) Route handler strips the `token` param from the
    URL (`navigate({ replace: true })`) after reading it; (b) never log
    the token in `[gym-invites]` prefixed error logs — log the token
    **hash** or the `invite_id` if available; (c) short default lifetime
    (7 days) and small quota (10 uses) limit blast radius of a leak.

- **Risk:** Race condition between two users redeeming the last use of an
  invite simultaneously (overshoots `max_uses`).
  - **Mitigation:** `select ... for update` on the invite row inside
    `redeem_gym_invite` serializes redemption. The row check constraint
    `uses_count <= max_uses` is a belt-and-suspenders guarantee.

- **Risk:** `is_default` references survive the frontend cleanup and
  produce silent schema drift when `database.types.ts` is regenerated.
  - **Mitigation:** Steps.md includes an explicit "regenerate types + run
    typecheck" task after the migration lands. ADR-008-dual-export-zod-schemas
    already enforces the domain-type-as-source-of-truth discipline, so
    Zod schemas catch residual drift at runtime.

- **Risk:** User who had their Home gym membership as their _only_
  membership leaves it and ends up in the zero-gym state with no guided
  recovery path.
  - **Mitigation:** Empty states on profile and display-picker surfaces
    route to browse/create CTAs (A-020). Not a risk — it's the designed
    zero-gym state.

- **Risk:** Pending transfer blocks gym deletion because of the FK
  `on delete cascade` semantics — actually _handled_: cascade from `gyms`
  drops the transfer row cleanly.

- **Unknown:** Whether to surface a pending-transfer notification at the
  profile banner level or scope it to the gym detail page.
  - **Resolution plan:** Start with detail-page-only for v1
    (simpler, covered by A-013a). Profile-level banner is a Should-Have
    that can be added without schema change — the `use-gym-transfers`
    query is already cheap.

## Testing Strategy

- **Supabase SQL tests** (`supabase/tests/021_*.sql`, one file per
  concern):
  - `021_is_default_drop.sql` — asserts A-001, A-002, A-003, A-006.
  - `021_no_signup_enrollment.sql` — asserts A-004; keeps A-005 regression
    coverage for the owner auto-enroll trigger.
  - `021_invite_lifecycle.sql` — asserts A-014, A-015, A-016, A-017, A-018.
  - `021_ownership_transfer.sql` — asserts A-012, A-013, A-013a, A-013b, A-013c.
  - Pattern mirrors `supabase/tests/018_trigger.sql`: `begin ... rollback`,
    DO-block, `raise exception` on failure.

- **Vitest (hooks + adapter)**:
  - `use-gym-invites.test.ts` — mock adapter, assert error discrimination
    and `onError` logging prefix.
  - `use-gym-transfers.test.ts` — same pattern.
  - Adapter unit tests for the new RPC call sites + `is_default` removal
    in existing gym adapter tests.

- **Playwright E2E**:
  - `gym-detail.spec.ts` — covers A-007, A-008, A-009, A-010, A-011.
  - `gym-invites.spec.ts` — generate, copy link, redeem as second user,
    expired/exhausted error states.
  - `gym-ownership-transfer.spec.ts` — propose, accept, decline, cancel,
    supersede flow.
  - `zero-gym-state.spec.ts` — fresh user signs up, profile + display
    picker render empty states (A-020).
  - `browse-member-counts.spec.ts` — asserts A-019.

## ADR Recommendations

- **ADR-015-gym-ownership-transfer-schema** — records the dedicated-table
  decision (Decision 1 above), the PK-as-invariant choice, and the
  security-definer RPC lifecycle. Worth formalizing because future
  gym-scoped workflows (invites, kicks, renames) might want the same
  pattern.
- **ADR-015-invite-token-redemption-via-rpc** — records the
  `security definer` redemption choice and the structured error taxonomy
  (Decisions 2 + 4). Referenceable the next time we add a token-based flow
  (e.g., accountability group invites).

Both ADRs share the 015 number intentionally (the repo already has
parallel ADRs at 007, 008, 009, 012, 013, 014 for orthogonal concerns).
Filenames: `Context/Decisions/ADR-015-gym-ownership-transfer-schema.md`
and `Context/Decisions/ADR-015-invite-token-redemption-via-rpc.md`.

## Revision History

| Date       | Change       | ADR                                                             |
| ---------- | ------------ | --------------------------------------------------------------- |
| 2026-04-08 | Initial tech | ADR-015-gym-ownership-transfer-schema, ADR-015-invite-token-rpc |
