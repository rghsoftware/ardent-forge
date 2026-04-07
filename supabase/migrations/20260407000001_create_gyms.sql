-- =============================================================================
-- Migration: Create gyms entity (F018 Gym-Scoped Displays)
-- Description: Adds the first-class `gym` entity that partitions the display
--              broadcast pipeline along physical-location boundaries. Replaces
--              the global `user_profiles.display_visible` opt-out with per-gym
--              membership.
--
-- This migration creates:
--   1. `gyms` table with single-default partial unique index
--   2. `gym_members` join table with composite primary key
--   3. RLS policies for both tables (two read postures, narrow write rules)
--   4. Column-level GRANT for the anon role on `gyms.(id, name)`
--   5. Trigger on `auth.users` insert that auto-enrolls new users in the
--      default gym (uses a security definer function with locked search_path)
--   6. One-shot data migration that creates a "Home" gym and enrolls every
--      existing user. Set-based, idempotent-by-construction (RD-18).
--   7. Drops the legacy `user_profiles.display_visible` column and the RLS
--      policy that referenced it (`user_profiles_public_display_name`).
--
-- IMPORTANT: The data migration `do $$` block runs as the postgres superuser
-- via `supabase db push`. RLS does not apply to the superuser, so the inserts
-- succeed without policy interference. Do NOT re-run this block as a non-
-- superuser -- the inserts would be blocked by the new gym_members policies.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. gyms table
-- ---------------------------------------------------------------------------
create table gyms (
    id              uuid        primary key default gen_random_uuid(),
    name            text        not null check (char_length(name) between 1 and 60),
    owner_user_id   uuid        not null references auth.users on delete cascade,
    is_default      boolean     not null default false,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

comment on table gyms is
    'Physical location where lifting happens. Owns a per-gym broadcast channel '
    '(display:gym:{id}). Members are tracked via gym_members.';
comment on column gyms.owner_user_id is
    'User who created the gym. Has UPDATE / DELETE rights and can kick members.';
comment on column gyms.is_default is
    'Marks the single default gym used to auto-enroll new users via the '
    'auth.users trigger. At most one row may be true (enforced by partial '
    'unique index idx_gyms_one_default).';

-- Partial unique index: at most one default gym instance-wide
create unique index idx_gyms_one_default
    on gyms (is_default)
    where is_default = true;


-- ---------------------------------------------------------------------------
-- 2. gym_members join table
-- ---------------------------------------------------------------------------
create table gym_members (
    gym_id     uuid        not null references gyms on delete cascade,
    user_id    uuid        not null references auth.users on delete cascade,
    joined_at  timestamptz not null default now(),
    primary key (gym_id, user_id)
);

comment on table gym_members is
    'Many-to-many membership between users and gyms. Composite PK (gym_id, user_id) '
    'gives free uniqueness and supports the "list members of a gym" query.';

-- Index for the "list gyms a user belongs to" query (M22 / TA21).
-- The composite PK already indexes (gym_id, user_id); this index covers
-- the reverse access pattern needed by the picker and workout header.
create index idx_gym_members_user_gym
    on gym_members (user_id, gym_id);


-- ---------------------------------------------------------------------------
-- 3. Enable RLS on both tables
-- ---------------------------------------------------------------------------
alter table gyms         enable row level security;
alter table gym_members  enable row level security;


-- ---------------------------------------------------------------------------
-- 4. SECURITY DEFINER helper for gym_members SELECT policy
--
-- The "list memberships in a gym I belong to" subquery would otherwise
-- self-reference gym_members and cause infinite recursion (Postgres error
-- 42P17). Mirror the existing pattern from
-- 20260403000001_fix_rls_infinite_recursion.sql -- a security definer helper
-- bypasses RLS for the inner lookup while still reading auth.uid() from the
-- caller's JWT context.
-- ---------------------------------------------------------------------------
create or replace function public.is_gym_member(p_gym_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select exists (
        select 1 from public.gym_members
        where gym_id = p_gym_id
          and user_id = auth.uid()
    );
$$;

comment on function public.is_gym_member(uuid) is
    'SECURITY DEFINER helper: returns true when auth.uid() is a member of the '
    'given gym. Bypasses RLS to prevent infinite recursion in gym_members policies.';

-- Helper for gym_members DELETE policy: is the caller the owner of this gym?
create or replace function public.is_gym_owner(p_gym_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select exists (
        select 1 from public.gyms
        where id = p_gym_id
          and owner_user_id = auth.uid()
    );
$$;

comment on function public.is_gym_owner(uuid) is
    'SECURITY DEFINER helper: returns true when auth.uid() owns the given gym. '
    'Used by gym_members DELETE policy so an owner can kick members.';


-- ---------------------------------------------------------------------------
-- 5. RLS policies on gyms
-- ---------------------------------------------------------------------------

-- Authenticated read: any logged-in user sees all gyms (M3 / RD-9 -- gyms are
-- public-within-instance for the friends-and-family scale).
create policy gyms_select_authenticated
    on gyms for select
    to authenticated
    using (true);

-- Anon read: scoped by the column-level GRANT below to (id, name) only.
-- The policy is permissive on rows; the column grant restricts which columns
-- the anon role may even ask for. Combined, anon can SELECT id, name from gyms
-- but `select * from gyms` fails on column-level access denial. (M21 / RD-16)
create policy gyms_select_anon
    on gyms for select
    to anon
    using (true);

-- Insert: any authenticated user, with the row check that owner_user_id
-- matches the caller (M4).
create policy gyms_insert_authenticated
    on gyms for insert
    to authenticated
    with check (owner_user_id = auth.uid());

-- Update: only the owner (M5). Both USING (which row visible to UPDATE) and
-- WITH CHECK (the new row state) require ownership.
create policy gyms_update_owner
    on gyms for update
    to authenticated
    using (owner_user_id = auth.uid())
    with check (owner_user_id = auth.uid());

-- Delete: only the owner (M5).
create policy gyms_delete_owner
    on gyms for delete
    to authenticated
    using (owner_user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 6. RLS policies on gym_members
-- ---------------------------------------------------------------------------

-- Select: a user can see their own memberships OR any membership row whose
-- gym they themselves belong to (so the picker can show "12 members"). The
-- second branch uses the security definer helper to avoid self-recursion.
-- (M8)
create policy gym_members_select_self_or_member
    on gym_members for select
    to authenticated
    using (
        user_id = auth.uid()
        or public.is_gym_member(gym_members.gym_id)
    );

-- Insert: a user can self-enroll, but cannot insert another user's membership
-- (M6).
create policy gym_members_insert_self
    on gym_members for insert
    to authenticated
    with check (user_id = auth.uid());

-- Delete: a user can leave (their own row), and the gym owner can kick any
-- member (M7). The owner-check uses the security definer helper to avoid a
-- correlated subquery that would re-trigger gym RLS.
create policy gym_members_delete_self_or_owner
    on gym_members for delete
    to authenticated
    using (
        user_id = auth.uid()
        or public.is_gym_owner(gym_members.gym_id)
    );


-- ---------------------------------------------------------------------------
-- 7. Anon column-level GRANT on gyms
--
-- The display route is unauthenticated -- it uses only the publishable key.
-- It needs to resolve a UUID into a human gym name once at boot for the
-- operator label (S5 / RD-16). Postgres column-level GRANT lets us restrict
-- exactly which columns the anon role may read, even with a permissive RLS
-- policy in place.
--
-- After this revoke + grant pair: anon can `select id, name from gyms` but
-- `select * from gyms` errors with column-level access denied.
-- ---------------------------------------------------------------------------
revoke all on gyms from anon;
grant select (id, name) on gyms to anon;

-- gym_members is fully locked from anon. Explicit revoke even though the
-- absence of any grant already denies access -- belt and suspenders.
revoke all on gym_members from anon;


-- ---------------------------------------------------------------------------
-- 8. auth.users trigger -- auto-enroll new users in the default gym (S7 / D7)
--
-- Fires after every insert into auth.users (covers email signup, OAuth,
-- admin tools, seed scripts -- every code path that creates a user). If a
-- default gym exists, the new user is enrolled. If not, the trigger no-ops.
-- The on conflict do nothing clause makes this idempotent against retries.
--
-- security definer + locked search_path is the canonical Postgres pattern
-- for trigger functions on the auth schema -- it lets the function read and
-- write public.gym_members regardless of the caller's RLS posture, while
-- preventing search-path attacks.
-- ---------------------------------------------------------------------------
create or replace function public.enroll_new_user_in_default_gym()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_default_gym_id uuid;
begin
    select id into v_default_gym_id
    from public.gyms
    where is_default = true
    limit 1;

    if v_default_gym_id is not null then
        insert into public.gym_members (gym_id, user_id)
        values (v_default_gym_id, new.id)
        on conflict do nothing;
    end if;

    return new;
end;
$$;

comment on function public.enroll_new_user_in_default_gym() is
    'Trigger function: auto-enrolls a freshly inserted auth.users row in the '
    'default gym (the row where gyms.is_default = true), if any. No-op when '
    'no default gym exists. Idempotent against insert retries.';

create trigger trg_auth_user_default_gym
    after insert on auth.users
    for each row execute function public.enroll_new_user_in_default_gym();


-- ---------------------------------------------------------------------------
-- 9. Drop the legacy display_visible column and the RLS policy that
--    referenced it. The policy must be dropped before the column to avoid
--    a "column referenced by policy" error.
--
-- The previous policy `user_profiles_public_display_name` (added in
-- 20260405000003_public_profile_select.sql) gated read access to display_name
-- on `display_visible = true`. With per-gym membership replacing the global
-- visibility flag, the simplest replacement is to allow any authenticated
-- user to read display_name from any user_profile -- consistent with the
-- gym pipeline where display names are operator labels less revealing than
-- the workout data already on the board view.
-- ---------------------------------------------------------------------------
drop policy if exists user_profiles_public_display_name on user_profiles;

create policy user_profiles_public_display_name
    on user_profiles for select
    to authenticated
    using (true);

comment on policy user_profiles_public_display_name on user_profiles is
    'F018 successor to the display_visible-gated policy. Display names are '
    'operator labels and are now exposed instance-wide to authenticated users; '
    'gym membership (not the dropped display_visible flag) is the new opt-in '
    'surface for workout broadcasts.';

alter table user_profiles drop column if exists display_visible;


-- ---------------------------------------------------------------------------
-- 10. One-shot data migration: create a "Home" gym and enroll every existing
--     user. Set-based, idempotent-by-construction (RD-18). Re-running this
--     block produces zero new rows.
--
-- Short-circuits:
--   - empty auth.users               -> return (no Home gym created)
--   - default gym already exists     -> return (no second Home gym created)
--
-- The membership insert uses `where not exists` so users who already have
-- any gym membership are not double-enrolled.
--
-- Runs as the postgres superuser; RLS does not apply.
-- ---------------------------------------------------------------------------
do $$
declare
    v_owner       uuid;
    v_gym_id      uuid;
    v_enroll_cnt  integer;
begin
    -- Pick the oldest user as the owner. Friends-and-family convention: the
    -- first user is typically the host who set up the instance.
    select id into v_owner
    from auth.users
    order by created_at asc
    limit 1;

    -- Empty instance: nothing to migrate.
    if v_owner is null then
        raise notice 'F018 migration: auth.users is empty -- no Home gym created.';
        return;
    end if;

    -- A default gym already exists (re-run scenario): nothing to do.
    if exists (select 1 from gyms where is_default = true) then
        raise notice 'F018 migration: default gym already exists -- skipping data migration.';
        return;
    end if;

    -- Create the default Home gym, owned by the host.
    insert into gyms (name, owner_user_id, is_default)
    values ('Home', v_owner, true)
    returning id into v_gym_id;

    -- Enroll every existing user (including the host) who is not already in
    -- any gym. The `where not exists` makes this set-based and idempotent --
    -- if a user already has any gym membership, they are skipped.
    insert into gym_members (gym_id, user_id)
    select v_gym_id, u.id
    from auth.users u
    where not exists (
        select 1 from gym_members gm where gm.user_id = u.id
    );

    select count(*) into v_enroll_cnt
    from gym_members
    where gym_id = v_gym_id;

    raise notice
        'F018 migration: created Home gym % (owner %), enrolled % users. '
        'Update the display TV URL to /display/gym/%.',
        v_gym_id, v_owner, v_enroll_cnt, v_gym_id;
end$$;
