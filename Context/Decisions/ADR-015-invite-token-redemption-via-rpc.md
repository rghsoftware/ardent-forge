# ADR-015: Invite Token Redemption via Security-Definer RPC

## Status

Accepted

## Context

Feature 021 (Gym Membership Explicit) introduces link-based gym invites: an
owner generates a tokenized invite, and a recipient redeems it to be added
to the gym's `gym_members` roster. Redemption must be:

- **Atomic** — the membership insert and the `uses_count` increment must
  succeed or fail together; partial state would let an invite be over-
  consumed or appear consumed without granting access.
- **Race-safe** — concurrent redemptions of the last remaining use must
  not exceed `max_uses`.
- **Privacy-preserving** — non-owners must not be able to enumerate
  invites for a gym, nor confirm whether a guessed token exists.
- **Distinguishable on failure** — the UI needs to render specific
  copy for "invalid", "expired", and "exhausted" tokens (per Spec
  assertions A-016 and A-017), not a generic redemption error.

The F018 baseline established `gym_invitations` as a future need but did
not implement redemption. Two implementation strategies were on the table
(see Tech.md Decision 2): a `security definer` RPC, or a pure-RLS path
that lets a non-member SELECT an invite by token and INSERT their own
`gym_members` row.

A separate concern (Tech.md Decision 4) is how the SQL layer signals
the three failure modes back to the TypeScript adapter: a custom
`SQLSTATE`, a structured `raise exception` message, or a return-shape
discriminator on a successful return path.

## Options Considered

### Option A: `security definer` RPC, structured exception messages

`public.redeem_gym_invite(p_token text) returns uuid` runs as superuser,
takes a `select ... for update` lock on the matching `gym_invitations`
row, validates expiry and quota, inserts the `gym_members` row with
`on conflict do nothing`, and increments `uses_count` — all in one
transaction. Failure modes raise `P0001` exceptions with messages
`INVITE_INVALID`, `INVITE_EXPIRED`, or `INVITE_EXHAUSTED`. The TS
adapter parses the `PostgrestError.message` prefix and returns a
discriminated `RedeemInviteError` union to callers.

**Pros:** Single-statement atomicity; row-lock serializes concurrent
redemptions; non-owners never see `gym_invitations` rows; one validation
path lives in one place; error taxonomy is explicit and exhaustive.
**Cons:** Adds an RPC; error parsing depends on a string prefix
contract between SQL and TS rather than a typed channel.

### Option B: Direct RLS — non-member SELECT + INSERT

Loosen `gym_invitations` SELECT to allow `auth.uid()` reads on rows
matching a token, and add an `INSERT` policy on `gym_members` whose
`with check` evaluates a `can_redeem_invite()` predicate. The frontend
issues two statements: SELECT the invite, then INSERT the membership.

**Pros:** No RPC; everything is "just RLS".
**Cons:** SELECT-by-token leaks invite existence to anyone guessing
tokens (even rejected guesses confirm the table shape). Atomicity is
split across two statements, so a crash between them can grant
membership without incrementing `uses_count`. Validation logic is
duplicated between the INSERT policy and the app code. The
`uses_count` increment cannot be performed by the redeemer at all
without a third elevated path, which negates the "pure RLS" appeal.

### Option C: RPC with custom `SQLSTATE` per failure

Same RPC shape as Option A, but each failure raises a unique
`SQLSTATE` (e.g., `'GI001'`, `'GI002'`, `'GI003'`) instead of a
structured message.

**Pros:** Failures are typed at the wire level rather than via string
parsing.
**Cons:** Custom SQLSTATEs are not propagated cleanly through every
PostgREST client path — `PostgrestError.code` is not always the raised
SQLSTATE, and the cost of guaranteeing it across upgrades exceeds the
benefit. String prefix parsing in the adapter is trivially testable
and survives PostgREST changes.

## Decision

**Option A: `security definer` RPC with structured exception messages
parsed into a discriminated TypeScript union.**

The migration introduces `public.redeem_gym_invite(p_token text)
returns uuid` with `security definer`, locked `search_path = public`,
and `grant execute ... to authenticated`. The body:

1. `select ... for update` on `gym_invitations` matching `p_token`.
2. `if not found then raise exception 'INVITE_INVALID' using errcode = 'P0001'; end if;`
3. `if expires_at <= now() then raise exception 'INVITE_EXPIRED' ...`
4. `if uses_count >= max_uses then raise exception 'INVITE_EXHAUSTED' ...`
5. `insert into gym_members (gym_id, user_id) values (gym_id, auth.uid()) on conflict do nothing;`
6. `update gym_invitations set uses_count = uses_count + 1 where id = ...;`
7. `return gym_id;`

The `gym_invitations` row carries a check constraint
`uses_count <= max_uses` as a belt-and-suspenders guarantee against
the row-lock failing.

The TypeScript adapter wraps the call in `supabase.rpc('redeem_gym_invite',
...)` and converts thrown `PostgrestError`s into a discriminated union:

```ts
export type RedeemInviteError =
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'exhausted' }
  | { kind: 'unknown'; cause: unknown }

export type RedeemInviteResult =
  | { ok: true; gymId: string }
  | { ok: false; error: RedeemInviteError }
```

Mapping is by message-prefix match against `INVITE_INVALID`,
`INVITE_EXPIRED`, `INVITE_EXHAUSTED`. Anything else falls through to
`{ kind: 'unknown', cause }` and is logged with the `[gym-invites]`
prefix per `.claude/rules/error-handling.md`.

## Consequences

- The redemption path has a single source of truth: one RPC, one
  transaction, one set of failure modes. New invariants (e.g., a
  per-user redemption cap) extend the RPC body without touching RLS
  policies or the adapter.
- Concurrent redemptions of the last available use are serialized by
  the row lock; the check constraint guarantees no overshoot even if
  the lock semantics change in a future Postgres upgrade.
- `gym_invitations` SELECT stays owner-only (A-018), so token guessing
  cannot enumerate invites — a guess returns `INVITE_INVALID` with no
  side channel.
- The error taxonomy is exhaustive and modeled with `satisfies
Record<RedeemInviteError['kind'], string>` for any user-facing copy
  map (per `.claude/rules/typescript-conventions.md`), so adding a new
  failure mode in the RPC forces a TS compile error in the adapter.
- The TS↔SQL contract is a string prefix, not a typed channel. The
  adapter must own this mapping with unit tests covering every prefix
  and an unknown-fallback case. The Vitest suite in
  `use-gym-invites.test.ts` enforces this.
- The same pattern is now the template for any future token-redemption
  flow on this codebase (e.g., accountability-group invites,
  programming-share links). This ADR is the reference.

## Alternatives Considered

See Options B and C above. Option B was rejected for atomicity and
privacy; Option C was rejected because the marginal type-safety win
does not justify the PostgREST-version coupling, and the prefix-based
union is already exhaustive at the TS layer.

## References

- Context/Features/021-Gym-Membership-Explicit/Tech.md — Decisions 2
  and 4
- Context/Features/021-Gym-Membership-Explicit/Spec.md — assertions
  A-014 through A-018
- `.claude/rules/error-handling.md` — distinguish input-validation
  from transport failures; `[module]` prefix logging
- `.claude/rules/typescript-conventions.md` — `satisfies Record<K, V>`
  for exhaustive maps
- `supabase/migrations/20260407000003_lock_gym_helper_functions.sql` —
  `security definer` + locked `search_path` precedent
