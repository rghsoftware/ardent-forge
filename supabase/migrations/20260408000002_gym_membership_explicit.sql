-- =============================================================================
-- Migration: Gym Membership Explicit (F021)
-- Description: Decouples gym membership from signup and adds the explicit
--              admin / invite / ownership-transfer surface.
--
-- This migration:
--   1. Drops the auto-enroll-on-signup trigger and its function
--   2. Drops the gyms.is_default column and its partial unique index
--   3. Creates gym_invitations (token-based, owner-issued)
--   4. Creates gym_ownership_transfers (single-pending invariant via PK)
--   5. Creates gym_member_counts view (security_invoker, kills the N+1)
--   6. Adds RLS policies on both new tables
--   7. Adds five security-definer RPCs for the invite + transfer lifecycle
--
-- Existing gym_members rows (including the F018 "Home" backfill) are
-- untouched. The "Home" gym row is grandfathered.
--
-- Depends on pgcrypto (enabled in 20260408000001_enable_pgcrypto.sql).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Drop auto-enroll-on-signup trigger + function
-- ---------------------------------------------------------------------------
drop trigger if exists trg_auth_user_default_gym on auth.users;
drop function if exists public.enroll_new_user_in_default_gym();


-- ---------------------------------------------------------------------------
-- 2. Drop the partial unique index and the is_default column
-- ---------------------------------------------------------------------------
drop index if exists public.idx_gyms_one_default;
alter table public.gyms drop column if exists is_default;


-- ---------------------------------------------------------------------------
-- 3. gym_invitations table
--
-- Owner-issued, opaque, URL-safe tokens. Tokens are generated server-side
-- inside the create_gym_invite RPC via pgcrypto's gen_random_bytes(24)
-- (=> 32 base64url chars; satisfies A-014's "token length >= 24" bound).
-- ---------------------------------------------------------------------------
create table public.gym_invitations (
    id          uuid        primary key default gen_random_uuid(),
    gym_id      uuid        not null references public.gyms(id) on delete cascade,
    token       text        not null,
    created_by  uuid        not null references auth.users(id),
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null,
    max_uses    integer     not null check (max_uses > 0),
    uses_count  integer     not null default 0 check (uses_count >= 0),

    constraint gym_invitations_uses_within_max
        check (uses_count <= max_uses),
    constraint gym_invitations_token_length
        check (char_length(token) >= 24)
);

comment on table public.gym_invitations is
    'F021: Owner-issued invite tokens for joining a gym. Tokens are opaque, '
    'URL-safe, generated server-side via pgcrypto, and validated through '
    'redeem_gym_invite (security definer).';

create unique index idx_gym_invitations_token
    on public.gym_invitations(token);

create index idx_gym_invitations_gym_id
    on public.gym_invitations(gym_id);


-- ---------------------------------------------------------------------------
-- 4. gym_ownership_transfers table
--
-- gym_id is the PRIMARY KEY -- this enforces the single-pending-transfer
-- invariant (A-013c) at the schema level. propose_gym_transfer uses
-- on conflict (gym_id) do update to supersede a prior pending row.
-- ---------------------------------------------------------------------------
create table public.gym_ownership_transfers (
    gym_id        uuid        primary key references public.gyms(id) on delete cascade,
    proposed_by   uuid        not null references auth.users(id),
    proposed_to   uuid        not null references auth.users(id),
    proposed_at   timestamptz not null default now(),

    constraint gym_ownership_transfers_not_self
        check (proposed_by <> proposed_to)
);

comment on table public.gym_ownership_transfers is
    'F021: Pending gym ownership transfer offers. gym_id PK enforces a single '
    'pending transfer per gym (A-013c). All lifecycle (propose / accept / '
    'cancel / decline) goes through security-definer RPCs.';


-- ---------------------------------------------------------------------------
-- 5. gym_member_counts view (kills the N+1 on the browse list)
--
-- security_invoker = true makes the view honor the caller's RLS against
-- gyms / gym_members so the existing SELECT policies carry through without
-- a dedicated view policy.
-- ---------------------------------------------------------------------------
create or replace view public.gym_member_counts
    with (security_invoker = true) as
select
    g.id                       as gym_id,
    count(gm.user_id)::integer as member_count
from public.gyms g
left join public.gym_members gm on gm.gym_id = g.id
group by g.id;

comment on view public.gym_member_counts is
    'F021: Per-gym member count rollup. security_invoker = true so the '
    'caller''s RLS on gyms / gym_members applies. One SELECT replaces N '
    'per-gym count queries on the browse list.';


-- ---------------------------------------------------------------------------
-- 6. Enable RLS on both new tables
-- ---------------------------------------------------------------------------
alter table public.gym_invitations         enable row level security;
alter table public.gym_ownership_transfers enable row level security;


-- ---------------------------------------------------------------------------
-- 7. RLS policies: gym_invitations
--
-- Only the gym owner can SELECT their gym's invites. INSERT / UPDATE / DELETE
-- are denied at the policy level -- creation goes through create_gym_invite
-- and the uses_count increment happens inside redeem_gym_invite, both
-- security definer.
-- ---------------------------------------------------------------------------
create policy gym_invitations_select_owner
    on public.gym_invitations for select
    to authenticated
    using (
        exists (
            select 1 from public.gyms
            where id = gym_invitations.gym_id
              and owner_user_id = auth.uid()
        )
    );

-- No INSERT / UPDATE / DELETE policies -- denied by default.


-- ---------------------------------------------------------------------------
-- 8. RLS policies: gym_ownership_transfers
--
-- Both the proposer and the target can SELECT a pending transfer row.
-- All DML is denied -- lifecycle is RPC-only.
-- ---------------------------------------------------------------------------
create policy gym_ownership_transfers_select_parties
    on public.gym_ownership_transfers for select
    to authenticated
    using (auth.uid() in (proposed_by, proposed_to));

-- No INSERT / UPDATE / DELETE policies -- denied by default.


-- ---------------------------------------------------------------------------
-- 9. RPC: create_gym_invite
--
-- Owner-only. Generates a URL-safe base64 token from 24 random bytes
-- (=> 32 chars after base64 encoding) and inserts the invitation row.
-- ---------------------------------------------------------------------------
create or replace function public.create_gym_invite(
    p_gym_id     uuid,
    p_expires_at timestamptz default null,
    p_max_uses   integer     default null
)
returns public.gym_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller     uuid := auth.uid();
    v_token      text;
    v_expires_at timestamptz := coalesce(p_expires_at, now() + interval '7 days');
    v_max_uses   integer     := coalesce(p_max_uses, 10);
    v_row        public.gym_invitations;
begin
    if v_caller is null then
        raise exception 'INVITE_INVALID: not authenticated';
    end if;

    if not exists (
        select 1 from public.gyms
        where id = p_gym_id
          and owner_user_id = v_caller
    ) then
        raise exception 'INVITE_INVALID: caller is not the gym owner';
    end if;

    if v_max_uses <= 0 then
        raise exception 'INVITE_INVALID: max_uses must be > 0';
    end if;

    -- URL-safe base64: substitute +/ for -_, strip any trailing '='
    v_token := translate(
        encode(gen_random_bytes(24), 'base64'),
        '+/=',
        '-_'
    );
    -- Strip the underscore that replaced any '=' padding (24 bytes => no padding,
    -- but belt-and-suspenders for future length changes).
    v_token := replace(v_token, '_', '');
    -- Re-encode if stripping shortened it below 24 chars (24 random bytes
    -- always yields 32 chars, so this is defensive only).
    if char_length(v_token) < 24 then
        v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
    end if;

    insert into public.gym_invitations (gym_id, token, created_by, expires_at, max_uses)
    values (p_gym_id, v_token, v_caller, v_expires_at, v_max_uses)
    returning * into v_row;

    return v_row;
end;
$$;

comment on function public.create_gym_invite(uuid, timestamptz, integer) is
    'F021: Owner-only RPC. Generates a URL-safe token and inserts a '
    'gym_invitations row. Defaults: 7-day expiry, 10 uses.';


-- ---------------------------------------------------------------------------
-- 10. RPC: redeem_gym_invite
--
-- Validates the token and inserts the caller into gym_members atomically.
-- Distinct error messages (INVITE_INVALID / INVITE_EXPIRED / INVITE_EXHAUSTED)
-- so the frontend adapter can branch on the prefix. select ... for update
-- serializes redemption against the max_uses race.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_gym_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller uuid := auth.uid();
    v_invite public.gym_invitations;
begin
    if v_caller is null then
        raise exception 'INVITE_INVALID: not authenticated';
    end if;

    select * into v_invite
    from public.gym_invitations
    where token = p_token
    for update;

    if not found then
        raise exception 'INVITE_INVALID: token not recognized';
    end if;

    if v_invite.expires_at <= now() then
        raise exception 'INVITE_EXPIRED: invite has expired';
    end if;

    if v_invite.uses_count >= v_invite.max_uses then
        raise exception 'INVITE_EXHAUSTED: invite has no remaining uses';
    end if;

    insert into public.gym_members (gym_id, user_id)
    values (v_invite.gym_id, v_caller)
    on conflict do nothing;

    update public.gym_invitations
       set uses_count = uses_count + 1
     where id = v_invite.id;

    return v_invite.gym_id;
end;
$$;

comment on function public.redeem_gym_invite(text) is
    'F021: Token redemption RPC. Distinct error messages INVITE_INVALID / '
    'INVITE_EXPIRED / INVITE_EXHAUSTED. Uses select ... for update to '
    'serialize against the max_uses race.';


-- ---------------------------------------------------------------------------
-- 11. RPC: propose_gym_transfer
--
-- Owner-only. Target must be a current member of the gym and must not be the
-- caller. Uses on conflict (gym_id) do update to supersede any prior pending
-- transfer (single-pending invariant lives on the PK).
-- ---------------------------------------------------------------------------
create or replace function public.propose_gym_transfer(
    p_gym_id         uuid,
    p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller uuid := auth.uid();
begin
    if v_caller is null then
        raise exception 'TRANSFER_INVALID: not authenticated';
    end if;

    if p_target_user_id = v_caller then
        raise exception 'TRANSFER_INVALID: cannot transfer to self';
    end if;

    if not exists (
        select 1 from public.gyms
        where id = p_gym_id
          and owner_user_id = v_caller
    ) then
        raise exception 'TRANSFER_INVALID: caller is not the gym owner';
    end if;

    if not exists (
        select 1 from public.gym_members
        where gym_id = p_gym_id
          and user_id = p_target_user_id
    ) then
        raise exception 'TRANSFER_INVALID: target is not a member of the gym';
    end if;

    insert into public.gym_ownership_transfers (gym_id, proposed_by, proposed_to)
    values (p_gym_id, v_caller, p_target_user_id)
    on conflict (gym_id) do update
        set proposed_by = excluded.proposed_by,
            proposed_to = excluded.proposed_to,
            proposed_at = now();
end;
$$;

comment on function public.propose_gym_transfer(uuid, uuid) is
    'F021: Owner-only RPC. Proposes (or supersedes) a pending ownership '
    'transfer for the given gym. Single-pending invariant enforced by '
    'gym_ownership_transfers PK on gym_id.';


-- ---------------------------------------------------------------------------
-- 12. RPC: accept_gym_transfer
--
-- Caller must be the proposed_to of the pending row. Flips gyms.owner_user_id
-- and clears the transfer row in a single transaction.
-- ---------------------------------------------------------------------------
create or replace function public.accept_gym_transfer(p_gym_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller   uuid := auth.uid();
    v_transfer public.gym_ownership_transfers;
begin
    if v_caller is null then
        raise exception 'TRANSFER_INVALID: not authenticated';
    end if;

    select * into v_transfer
    from public.gym_ownership_transfers
    where gym_id = p_gym_id
    for update;

    if not found then
        raise exception 'TRANSFER_INVALID: no pending transfer for this gym';
    end if;

    if v_transfer.proposed_to <> v_caller then
        raise exception 'TRANSFER_INVALID: caller is not the proposed recipient';
    end if;

    update public.gyms
       set owner_user_id = v_caller,
           updated_at    = now()
     where id = p_gym_id;

    delete from public.gym_ownership_transfers
     where gym_id = p_gym_id;
end;
$$;

comment on function public.accept_gym_transfer(uuid) is
    'F021: Recipient-only RPC. Flips gyms.owner_user_id to the caller and '
    'clears the transfer row in a single transaction.';


-- ---------------------------------------------------------------------------
-- 13. RPC: cancel_or_decline_gym_transfer
--
-- Either party (proposer or target) can call this. Deletes the pending row.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_or_decline_gym_transfer(p_gym_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller   uuid := auth.uid();
    v_transfer public.gym_ownership_transfers;
begin
    if v_caller is null then
        raise exception 'TRANSFER_INVALID: not authenticated';
    end if;

    select * into v_transfer
    from public.gym_ownership_transfers
    where gym_id = p_gym_id
    for update;

    if not found then
        raise exception 'TRANSFER_INVALID: no pending transfer for this gym';
    end if;

    if v_caller not in (v_transfer.proposed_by, v_transfer.proposed_to) then
        raise exception 'TRANSFER_INVALID: caller is not a party to this transfer';
    end if;

    delete from public.gym_ownership_transfers
     where gym_id = p_gym_id;
end;
$$;

comment on function public.cancel_or_decline_gym_transfer(uuid) is
    'F021: Either-party RPC. Deletes the pending transfer row. Used for '
    'owner cancel and recipient decline (semantically symmetric).';


-- ---------------------------------------------------------------------------
-- 14. Grants
--
-- Default-deny convention: revoke from public/anon, grant only to authenticated.
-- ---------------------------------------------------------------------------
revoke execute on function public.create_gym_invite(uuid, timestamptz, integer) from public;
revoke execute on function public.create_gym_invite(uuid, timestamptz, integer) from anon;
grant  execute on function public.create_gym_invite(uuid, timestamptz, integer) to authenticated;

revoke execute on function public.redeem_gym_invite(text) from public;
revoke execute on function public.redeem_gym_invite(text) from anon;
grant  execute on function public.redeem_gym_invite(text) to authenticated;

revoke execute on function public.propose_gym_transfer(uuid, uuid) from public;
revoke execute on function public.propose_gym_transfer(uuid, uuid) from anon;
grant  execute on function public.propose_gym_transfer(uuid, uuid) to authenticated;

revoke execute on function public.accept_gym_transfer(uuid) from public;
revoke execute on function public.accept_gym_transfer(uuid) from anon;
grant  execute on function public.accept_gym_transfer(uuid) to authenticated;

revoke execute on function public.cancel_or_decline_gym_transfer(uuid) from public;
revoke execute on function public.cancel_or_decline_gym_transfer(uuid) from anon;
grant  execute on function public.cancel_or_decline_gym_transfer(uuid) to authenticated;

grant select on public.gym_member_counts to authenticated;
