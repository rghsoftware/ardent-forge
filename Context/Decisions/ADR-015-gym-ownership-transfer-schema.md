# ADR-015: Gym ownership transfer schema and lifecycle

## Status

Accepted

## Context

Feature 021 (Gym Membership Explicit) introduces an owner-initiated gym
ownership transfer flow. Spec assertions A-012, A-013, A-013a, A-013b, and
A-013c require:

- An owner can propose transfer of a gym to an existing member (A-012).
- A pending transfer is visible to both the proposing owner and the
  proposed-to target (A-013, A-013a).
- Either party can cancel/decline a pending transfer; the target can accept,
  which atomically rotates `gyms.owner_user_id` (A-013b).
- A gym can have **at most one** pending transfer at any time. Proposing a
  new transfer while one is already pending must supersede the prior pending
  row, not coexist with it (A-013c).

The schema must enforce the single-pending invariant at the database level
(not in application code), keep `gyms` lean of transient state, and isolate
the RLS surface so the transfer-visibility rule does not leak into the
hot-path `gyms` read policy. Tech.md Decision 1 enumerated two options:

- **Option A:** Dedicated `gym_ownership_transfers` table with `gym_id` as
  primary key.
- **Option B:** Nullable `pending_transfer_*` columns on `gyms` itself.

Option B widens every `gyms` row for a state most gyms never have,
complicates `gyms` RLS (the target user must see pending-transfer fields
without other owner-only metadata), and would require a partial unique
index on a nullable column to enforce the single-pending invariant.

## Decision

Pending gym ownership transfers live in a dedicated table with `gym_id` as
the primary key, and the table's lifecycle is managed exclusively through
`security definer` RPCs. Direct DML on the table is denied at the RLS
policy level for all roles.

### Schema

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

`gym_id` as `primary key` is the load-bearing constraint: it makes the
single-pending invariant (A-013c) a schema-level guarantee, not an
application convention. A second `propose_gym_transfer` call for the same
gym uses `insert ... on conflict (gym_id) do update set ...` to atomically
supersede the prior pending row inside a single statement. There is no race
window in which two pending transfers can coexist.

`on delete cascade` from `gyms` ensures that deleting a gym drops any
pending transfer in the same transaction; no orphan rows are possible.

### RLS

- `select`: `auth.uid() in (proposed_by, proposed_to)`. Owner and target
  are the only parties who can see the row. Non-parties (including other
  members of the same gym) cannot enumerate pending transfers.
- `insert`, `update`, `delete`: **denied for all roles**. Lifecycle
  mutations are funneled through `security definer` RPCs only.

### Lifecycle RPCs

All four RPCs are `security definer` with locked `search_path = public`,
following the established pattern in
`20260407000003_lock_gym_helper_functions.sql`. Each RPC is granted
`execute` to `authenticated` only.

1. **`propose_gym_transfer(p_gym_id uuid, p_target uuid)`**
   - Asserts `auth.uid() = gyms.owner_user_id` for `p_gym_id`.
   - Asserts `p_target` is an existing `gym_members` row for `p_gym_id`.
   - Asserts `p_target <> auth.uid()` (also enforced by check constraint).
   - `insert into gym_ownership_transfers (gym_id, proposed_by, proposed_to)
values (...) on conflict (gym_id) do update set proposed_to = excluded.proposed_to,
proposed_by = excluded.proposed_by, proposed_at = now()`.

2. **`accept_gym_transfer(p_gym_id uuid)`**
   - Asserts the caller equals `proposed_to` on the pending row.
   - In a single transaction: `update gyms set owner_user_id = auth.uid()
where id = p_gym_id` and `delete from gym_ownership_transfers
where gym_id = p_gym_id`.

3. **`cancel_or_decline_gym_transfer(p_gym_id uuid)`**
   - Asserts caller is `proposed_by` (cancel) or `proposed_to` (decline).
   - `delete from gym_ownership_transfers where gym_id = p_gym_id`.
   - One RPC handles both cancel and decline because the wire effect is
     identical (delete the row); the only difference is which party called
     it, and that distinction is not load-bearing for any downstream
     consumer.

There is **no** propose RPC variant that bypasses the supersede behavior,
and there is no application-level "is there a pending transfer?" check
guarding the propose path. The PK conflict is the single source of truth.

## Consequences

### Positive

- Single-pending invariant (A-013c) is enforced by the database, not by
  application logic. A future caller cannot accidentally create two
  pending transfers for the same gym, even under concurrent requests.
- `gyms` row width is unchanged. The hot-path `select` from `gyms` does
  not pay any cost for a feature most gyms never use.
- `gyms` RLS policy remains simple. The transfer-visibility rule is
  isolated to the transfer table and cannot leak owner-only fields to the
  proposed-to target.
- Cascade-on-delete makes gym deletion safe with respect to pending
  transfers — a single FK clause eliminates an entire class of orphan-row
  bugs.
- The `security definer` RPC funnel guarantees that every lifecycle
  transition runs the same authorization checks. There is no second code
  path (direct DML, application-level update) that could drift out of
  sync with the canonical rules.
- Future audit-trail requirements can be added by writing to a sibling
  `gym_ownership_transfer_history` append-only table from inside the same
  RPCs, without changing the `gyms` schema.

### Negative

- Adds one table, one PK index, and four RPCs to the gym-domain surface.
  At friends-and-family scale this is negligible, but the RPC count is
  worth tracking — domain RPC sprawl is a code-smell at higher scales.
- The `cancel_or_decline_gym_transfer` RPC merges two semantically
  distinct actions (owner cancel vs target decline) behind one entry
  point. If a future requirement needs to distinguish them in audit logs
  or notifications, the RPC will need to split or accept a discriminator
  parameter.
- A `gyms.owner_user_id` rotation now happens inside an RPC rather than
  via direct update. Anything that observes `gyms` writes (triggers,
  subscriptions, future CDC) must treat the RPC as an opaque mutation
  source, not assume direct DML.

### Neutral

- The PK-as-invariant pattern is reusable. Future single-pending-per-X
  workflows in the gym domain (e.g., pending name change, pending
  membership policy proposal) can adopt the same shape: `x_id primary key
references parent on delete cascade` plus a `security definer` RPC
  funnel.

## Alternatives Considered

### Option B: Nullable `pending_transfer_*` columns on `gyms`

Rejected. Three problems:

1. **RLS leakage.** The proposed-to target needs to see the pending
   transfer fields, but not the rest of the owner-only metadata on
   `gyms`. The cleanest way to express this is column-level grants or a
   separate view, both of which add more surface than a dedicated table.
2. **Invariant enforcement.** A partial unique index on a nullable column
   can enforce "at most one non-null per gym" but cannot atomically
   supersede a pending row in a single statement. The application would
   need to either lock the row first or rely on retry-on-conflict logic,
   both of which are more complex than `on conflict (gym_id) do update`.
3. **Row width.** Most gyms never have a pending transfer. Carrying three
   nullable columns (`pending_transfer_to`, `pending_transfer_at`,
   `pending_transfer_by`) on every `gyms` row is permanent overhead for a
   transient state.

### Allow direct DML on `gym_ownership_transfers` with policy-based authorization

Rejected. Multi-statement lifecycle transitions (especially `accept`,
which mutates both `gyms` and `gym_ownership_transfers`) cannot be
expressed atomically through RLS policies. Splitting the accept flow
across two client-side statements would open a window where the transfer
row is gone but `owner_user_id` has not yet rotated, or vice versa. The
`security definer` RPC keeps both writes in one transaction with a single
authorization check at the entry point.

### Single combined `manage_gym_transfer(action text, ...)` RPC

Rejected. Stringly-typed action discriminators inside a single RPC make
the authorization rules harder to read and harder to test. Four named
RPCs, each with one job and one set of assertions, are easier to audit
and easier to grant/revoke independently if future role hierarchies
demand it.

## References

- Feature 021 Tech.md, Decision 1 (`Context/Features/021-Gym-Membership-Explicit/Tech.md`)
- Feature 021 Spec.md assertions A-012, A-013, A-013a, A-013b, A-013c
- ADR-012-gym-partitioning-model (gym-scoped state lives in gym-keyed
  tables under RLS)
- `supabase/migrations/20260407000003_lock_gym_helper_functions.sql`
  (established `security definer` + locked `search_path` pattern)
